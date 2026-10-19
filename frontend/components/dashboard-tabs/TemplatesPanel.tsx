import { useEffect, useState } from "react";
import { fetchProposalTemplates, createProposalTemplate, updateProposalTemplate, deleteProposalTemplate } from "@/lib/api";
import { useToast } from "@/components/Toast";
import TemplatesTab, { type ProposalTemplateItem } from "./TemplatesTab";

/** Stays mounted while switching tabs so unsaved drafts survive navigation. */
export default function TemplatesPanel({ publicKey }: { publicKey: string }) {
  const { success } = useToast();
  const [templates, setTemplates] = useState<ProposalTemplateItem[]>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchProposalTemplates().then((items) => { if (active) setTemplates(items); }).catch(() => {});
    return () => { active = false; };
  }, [publicKey]);

  async function save() {
    if (!name.trim() || !content.trim()) return;
    if (editingId) {
      const updated = await updateProposalTemplate(editingId, { name, content });
      setTemplates((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditingId(null);
    } else {
      const created = await createProposalTemplate({ name, content });
      setTemplates((items) => [created, ...items]);
    }
    setName("");
    setContent("");
  }

  async function remove() {
    if (!deleteId) return;
    await deleteProposalTemplate(deleteId);
    setTemplates((items) => items.filter((item) => item.id !== deleteId));
    setDeleteId(null);
    success("Template deleted");
  }

  return <TemplatesTab
    templates={templates} templateName={name} templateContent={content}
    editingTemplateId={editingId} onTemplateNameChange={setName}
    onTemplateContentChange={setContent} onSave={save}
    onEdit={(template) => { setEditingId(template.id); setName(template.name); setContent(template.content); }}
    confirmDeleteTemplate={deleteId} onRequestDelete={setDeleteId}
    onCancelDelete={() => setDeleteId(null)} onConfirmDelete={remove}
  />;
}
