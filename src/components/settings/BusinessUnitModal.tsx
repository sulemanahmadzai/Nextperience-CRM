import { useState, useEffect } from "react";
import { X, Save, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
}

interface BusinessUnitModalProps {
  company: Company | null;
  onClose: (shouldRefresh?: boolean) => void;
}

export default function BusinessUnitModal({
  company,
  onClose,
}: BusinessUnitModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    logo_url: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || "",
        slug: company.slug || "",
        logo_url: company.logo_url || "",
        is_active: company.is_active ?? true,
      });
    } else {
      setFormData({
        name: "",
        slug: "",
        logo_url: "",
        is_active: true,
      });
    }
    setError("");
  }, [company]);

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: company ? prev.slug : generateSlug(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const data: any = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        is_active: formData.is_active,
      };

      if (formData.logo_url.trim()) {
        data.logo_url = formData.logo_url.trim();
      } else {
        data.logo_url = null;
      }

      if (company) {
        // Update existing company
        const { error: updateError } = await supabase
          .from("companies")
          // @ts-ignore - Database types may not include all company fields
          .update(data)
          .eq("id", company.id);

        if (updateError) throw updateError;

        if (user) {
          await supabase.from("audit_logs").insert({
            company_id: company.id,
            entity_type: "company",
            entity_id: company.id,
            action: "update",
            changed_fields: data,
            user_id: user.id,
          } as any);
        }
      } else {
        // Create new company
        const { error: insertError, data: newCompany } = await supabase
          .from("companies")
          .insert([data] as any)
          .select()
          .single();

        if (insertError) throw insertError;

        if (user && newCompany) {
          await supabase.from("audit_logs").insert({
            company_id: (newCompany as any).id,
            entity_type: "company",
            entity_id: (newCompany as any).id,
            action: "create",
            changed_fields: newCompany,
            user_id: user.id,
          } as any);
        }
      }

      onClose(true);
    } catch (error: any) {
      console.error("Error saving business unit:", error);
      setError(error.message || "Failed to save business unit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!company || !user) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${company.name}"?\n\n` +
        `This action cannot be undone and will permanently delete:\n` +
        `- All associated users, roles, and permissions\n` +
        `- All customers, leads, quotations, and related data\n` +
        `- All templates and configurations\n\n` +
        `Type "DELETE" to confirm:`
    );

    if (!confirmed) return;

    const confirmationText = window.prompt(
      `Type "DELETE" (all caps) to confirm deletion of "${company.name}":`
    );

    if (confirmationText !== "DELETE") {
      setError("Deletion cancelled. Confirmation text did not match.");
      return;
    }

    setDeleting(true);
    setError("");

    try {
      // Log audit before deletion
      await supabase.from("audit_logs").insert({
        company_id: company.id,
        entity_type: "company",
        entity_id: company.id,
        action: "delete",
        changed_fields: { deleted: true, name: company.name },
        user_id: user.id,
      } as any);

      // Delete the company (this will cascade delete related records)
      const { error: deleteError } = await supabase
        .from("companies")
        .delete()
        .eq("id", company.id);

      if (deleteError) throw deleteError;

      onClose(true);
    } catch (error: any) {
      console.error("Error deleting business unit:", error);
      setError(error.message || "Failed to delete business unit");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {company ? "Edit Business Unit" : "Add Business Unit"}
          </h2>
          <button
            onClick={() => onClose()}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Business Unit Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                required
                placeholder="e.g., Marketing Division"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Slug *
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                required
                placeholder="e.g., marketing-division"
              />
              <p className="text-xs text-slate-500 mt-1">
                URL-friendly identifier (auto-generated from name)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Logo URL
              </label>
              <input
                type="url"
                value={formData.logo_url}
                onChange={(e) =>
                  setFormData({ ...formData, logo_url: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="w-4 h-4 text-slate-600 border-slate-300 rounded focus:ring-slate-500"
              />
              <label
                htmlFor="is_active"
                className="text-sm font-medium text-slate-700"
              >
                Active
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
            <div>
              {company && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? "Deleting..." : "Delete Business Unit"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                disabled={saving || deleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving
                  ? "Saving..."
                  : company
                  ? "Update Business Unit"
                  : "Create Business Unit"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
