# Monitoring: local setup and production operation

MarketPay has two independent observability pipelines:

- **Metrics:** Express `/metrics` → Prometheus → Grafana.
- **Logs:** Docker `json-file` logs → Filebeat → Elasticsearch → Kibana.

Grafana does not require ELK. Enabling the `logging` Compose profile does not
start Prometheus or Grafana. Run commands below from the repository root.

## Local Prometheus and Grafana

Prerequisites: Docker Engine/Desktop with Compose v2, the application's local
configuration described in [Getting Started](getting-started.md), and free ports
4000, 9090 and 3001. Inspect the backend Dockerfile and dependency scripts before
building. These commands start the development backend and its database/cache;
they do not start the frontend or production nginx/certbot services.

```bash
# Prepare backend/.env from backend/.env.example and set local secrets first.
# Override the image's production-only dependency set: it has no nodemon.
# Inside Docker the database hostname is postgres, not localhost.
monitoring_override=$(mktemp /tmp/marketpay-monitoring.XXXXXX)
cat > "$monitoring_override" <<'YAML'
services:
  backend:
    command: node src/server.js
    env_file:
      - backend/.env
    environment:
      DATABASE_URL: postgresql://stellarwork:stellarwork_dev@postgres:5432/stellarwork
YAML
docker compose -p marketpay -f docker-compose.yml -f "$monitoring_override" up -d postgres redis
docker compose -p marketpay -f docker-compose.yml -f "$monitoring_override" run --build --rm backend node src/db/migrate.js
docker compose -p marketpay -f docker-compose.yml -f "$monitoring_override" up -d backend
# Check readiness before starting the scrapers:
curl --fail http://localhost:4000/api/health
curl --fail http://localhost:4000/metrics

docker run -d --name marketpay-prometheus --network marketpay_default --network-alias prometheus \
  -p 127.0.0.1:9090:9090 \
  -v "$PWD/monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
  -v "$PWD/monitoring/prometheus/rules:/etc/prometheus/rules:ro" \
  prom/prometheus:v2.55.1

# Use a fresh local password; do not reuse production credentials.
read -r -s -p 'Local Grafana password: ' GF_SECURITY_ADMIN_PASSWORD; echo
export GF_SECURITY_ADMIN_PASSWORD
docker run -d --name marketpay-grafana --network marketpay_default \
  -p 127.0.0.1:3001:3000 \
  -e GF_SECURITY_ADMIN_USER=admin -e GF_SECURITY_ADMIN_PASSWORD \
  -e GF_USERS_ALLOW_SIGN_UP=false \
  -v "$PWD/monitoring/grafana/provisioning:/etc/grafana/provisioning:ro" \
  -v "$PWD/monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro" \
  grafana/grafana:11.4.0
unset GF_SECURITY_ADMIN_PASSWORD
```

The password prompt uses Bash (`bash` first if your shell does not support
`read -s -p`). The network alias makes the provisioned datasource's
`http://prometheus:9090` URL resolve to the local Prometheus container.

Open <http://localhost:9090/targets>: `marketpay-backend` and `prometheus` should
be **UP**. The supplied config also scrapes `node-exporter:9100`; it will be DOWN
in this minimal local setup. Host metrics are optional locally; the Linux host
mounts in `docker-compose.prod.yml` are unsuitable for native macOS host metrics.
Open <http://localhost:3001>, sign in as `admin`, and open the **MarketPay** folder.
The provisioned Prometheus datasource should pass **Save & test**. Generate API
traffic, then query `http_requests_total` in Prometheus and refresh dashboards.
Latency percentiles need multiple requests and can be empty on a fresh instance.

Cleanup (preserves the Compose database volume):

```sh
docker rm -f marketpay-grafana marketpay-prometheus
docker compose -p marketpay -f docker-compose.yml -f "$monitoring_override" down
rm "$monitoring_override"
```

## Authenticating `/metrics`

The authoritative implementation is
[`metricsAuth.js`](../backend/src/middleware/metricsAuth.js). It accepts either
`Authorization: Bearer <token>` or `X-Metrics-Token: <token>`.

| Backend environment variable | Meaning |
| --- | --- |
| `METRICS_TOKEN` | Preferred shared scrape secret. |
| `METRICS_SECRET` | Legacy alias, used only if `METRICS_TOKEN` is unset. |
| `METRICS_ALLOW_PRIVATE_NETWORK` | Defaults to allowing internal/loopback callers without a token. Set `false` (also accepts `0` or `no`) to require authentication everywhere. |

A wrong presented token is rejected even on an internal address. Missing or
incorrect credentials return **401** with a Bearer challenge. Keep `/metrics`
private even when using authentication; it reveals operational detail.

For enforced authentication, pass `METRICS_TOKEN` and
`METRICS_ALLOW_PRIVATE_NETWORK=false` into the backend container using a local
Compose override (the current development Compose file does not forward these
variables automatically). Mount the same secret as
`/run/secrets/metrics_token` in Prometheus and enable the existing commented
`authorization.type: Bearer` / `credentials_file` block in the backend scrape job.
Prometheus does not expand shell variables in its YAML. Keep secret files out of
Git and ensure the Prometheus container user can read them.

Verify both paths after restarting the backend:

```sh
curl -i http://localhost:4000/metrics       # expect 401 with enforcement enabled
curl --fail -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:4000/metrics
```

## Dashboard inventory

| Dashboard file | What to use it for |
| --- | --- |
| [`monitoring/grafana/dashboards/marketpay-overview.json`](../monitoring/grafana/dashboards/marketpay-overview.json) | Quick service health: request rate, p99/HTTP latency, error rate, database connections and escrow release errors. |
| [`monitoring/grafana/dashboards/marketpay-backend-metrics.json`](../monitoring/grafana/dashboards/marketpay-backend-metrics.json) | Detailed backend diagnosis: golden signals, top/slow routes, WebSocket activity/churn, query latency/failures, pool saturation, heap/event-loop lag and notification backlog. |
| [`infra/grafana/dashboards/stellar-marketpay.json`](../infra/grafana/dashboards/stellar-marketpay.json) | Alternate platform overview: HTTP percentiles/status rates, WebSockets, notifications, database pool, process memory/CPU. Not automatically provisioned by the Compose configuration; import manually if needed and select the Prometheus datasource. |

[`backend/src/metrics.js`](../backend/src/metrics.js) defines metric names and
units. Both compatibility `marketpay_http_*` metrics and unprefixed detailed
metrics exist; do not assume every metric has the process collector's
`marketpay_` prefix. Check actual exposition and dashboard queries when diagnosing
an empty panel. Alert rules live in `monitoring/prometheus/rules/`; Prometheus
loads them, but notification delivery also requires an Alertmanager deployment
and `alerting` configuration, neither provided by this local walkthrough.

## ELK logging profile

```sh
docker compose -p marketpay --profile logging up -d elasticsearch kibana filebeat
curl --fail http://localhost:9200/_cluster/health
bash monitoring/setup-elk.sh
```

Kibana is at <http://localhost:5601>. The setup script PUTs the
`filebeat-retention` ILM policy (daily/50 GB rollover; delete after 30 days).
Its message about an error-rate alert is only a placeholder: it does **not**
create an alert or import application dashboards. Verify the policy with
`GET /_ilm/policy/filebeat-retention` and lifecycle assignment with
`GET /filebeat-*/_ilm/explain`; existing indices may need separate migration.

`monitoring/filebeat/filebeat.yml` reads Docker container logs, adds Docker
metadata through the socket, and forwards to `elasticsearch:9200`. It enables
Filebeat dashboards and references the retention policy. The container-log path
and socket mounts require Linux Docker access; Docker Desktop's VM may not expose
host container logs at that path. Check `docker compose -p marketpay logs filebeat`
and verify documents arrive before relying on it. Socket access is privileged.
The development Elasticsearch disables security: keep these ports local/firewalled
and never copy that setting into a public production deployment.

## Production topology and checks

`docker-compose.prod.yml` provisions Prometheus, Linux node-exporter and Grafana
with external Docker secrets named `grafana_admin_user` and
`grafana_admin_password`, read via Grafana's `GF_SECURITY_ADMIN_USER__FILE` and
`GF_SECURITY_ADMIN_PASSWORD__FILE` settings. External secrets require a compatible
deployment runtime; plain local Compose may reject them. Use the local setup
above for development. Inspect its `secrets` section for other required secrets
before running `docker compose -f docker-compose.prod.yml config`.

The production backend is **backend-blue** or **backend-green**; the checked-in
scrape target **backend:4000** matches development only. Configure a stable
internal `backend` alias for the active deployment or change the scrape target
on each switch. If scraping both colors, add distinct instance/color labels so
queries do not double-count traffic. Apply the metrics secret to both backends
and the scraper when enforcing token authentication.

Restrict published Grafana/Prometheus/node-exporter ports using private binds,
firewall/VPN or an authenticated TLS reverse proxy. Add persistent storage and
retention sizing for Prometheus/Grafana (the provided production Compose mounts
configuration, not their data directories), backups, and alert delivery. Keep
Elasticsearch/Kibana authenticated and private if deployed. Use scrape-target
health, dashboard queries, alert-rule status and log ingestion as separate rollout
checks; a healthy API alone does not establish monitoring health.

## Validation status

The local override also forwards backend/.env and replaces the development
Compose command (`npm run dev`) because the image prunes nodemon.
Commands and paths above were checked against the repository configuration.
A live Docker bring-up, authenticated scrape, Grafana login and ELK ingestion
still need to be verified in an environment with the configured application
services and container runtime; this documentation does not claim a live run.
