import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { FolderTree, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { adminFetch } from '../lib/api';
import { EmptyState, Field, Modal, Pill } from './ui';

export type AdminCategory = { _id: string; name: string; slug: string; description?: string; parentId?: string | null; isActive: boolean; displayOrder: number; productCount: number };
export type AdminBrand = { _id: string; name: string; slug: string; website?: string; isActive: boolean; productCount: number };

type Props = { isAdmin: boolean; reloadKey: number; onNotice: (message: string) => void; onError: (message: string) => void };

export function CatalogSetup({ isAdmin, reloadKey, onNotice, onError }: Props) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState<AdminCategory | null | false>(false);
  const [brandDialog, setBrandDialog] = useState<AdminBrand | null | false>(false);

  const load = async () => {
    try {
      const [categoryResult, brandResult] = await Promise.all([adminFetch('/admin/categories'), adminFetch('/admin/brands')]);
      setCategories(categoryResult.data);
      setBrands(brandResult.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not load catalog setup');
    } finally { setLoaded(true); }
  };

  useEffect(() => { void load(); }, [reloadKey]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      onNotice(message);
      await load();
      return true;
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Request failed');
      return false;
    }
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editing = categoryDialog || null;
    const payload = {
      name: String(form.get('name')).trim(),
      slug: String(form.get('slug')).trim() || undefined,
      description: String(form.get('description')).trim(),
      parentId: String(form.get('parentId')) || null,
      displayOrder: Number(form.get('displayOrder')) || 0,
      isActive: form.get('isActive') === 'on',
    };
    const saved = await run(() => adminFetch(editing ? `/admin/categories/${editing._id}` : '/admin/categories', {
      method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload),
    }), editing ? 'Category saved.' : 'Category created.');
    if (saved) setCategoryDialog(false);
  };

  const saveBrand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editing = brandDialog || null;
    const payload = {
      name: String(form.get('name')).trim(),
      slug: String(form.get('slug')).trim() || undefined,
      website: String(form.get('website')).trim(),
      isActive: form.get('isActive') === 'on',
    };
    const saved = await run(() => adminFetch(editing ? `/admin/brands/${editing._id}` : '/admin/brands', {
      method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload),
    }), editing ? 'Brand saved.' : 'Brand created.');
    if (saved) setBrandDialog(false);
  };

  const removeCategory = (category: AdminCategory) => {
    if (window.confirm(`Delete category ${category.name}?`)) void run(() => adminFetch(`/admin/categories/${category._id}`, { method: 'DELETE' }), 'Category deleted.');
  };
  const removeBrand = (brand: AdminBrand) => {
    if (window.confirm(`Delete brand ${brand.name}?`)) void run(() => adminFetch(`/admin/brands/${brand._id}`, { method: 'DELETE' }), 'Brand deleted.');
  };

  const parentName = (id?: string | null) => categories.find((category) => category._id === id)?.name;
  const editingCategory = categoryDialog || null;
  const editingBrand = brandDialog || null;
  const count = (value: number) => `${value} product${value === 1 ? '' : 's'}`;
  const rowActions = (onEdit: () => void, onDelete: () => void, inUse: boolean) => <div className="flex shrink-0 items-center gap-0.5">
    <button onClick={onEdit} title="Edit" className="icon-btn"><Pencil className="size-3.5" /></button>
    {isAdmin && <button onClick={onDelete} disabled={inUse} title={inUse ? 'Still used by products — reassign them first' : 'Delete'} className="icon-btn hover:bg-rose-50 hover:text-rose-700"><Trash2 className="size-3.5" /></button>}
  </div>;

  return <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
    <Panel icon={<FolderTree className="size-4" />} title="Categories" total={categories.length} onAdd={() => setCategoryDialog(null)} addLabel="Category">
      {categories.length ? <ul className="divide-y divide-slate-100">
        {categories.map((category) => <li key={category._id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/70">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold text-slate-900">{category.name}</span>{!category.isActive && <Pill>Hidden</Pill>}{parentName(category.parentId) && <Pill tone="blue">in {parentName(category.parentId)}</Pill>}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">/{category.slug} · {count(category.productCount)}</p>
          </div>
          {rowActions(() => setCategoryDialog(category), () => removeCategory(category), category.productCount > 0)}
        </li>)}
      </ul> : loaded && <EmptyState title="No categories yet" hint="Categories power storefront navigation and filters." />}
    </Panel>

    <Panel icon={<Tags className="size-4" />} title="Brands" total={brands.length} onAdd={() => setBrandDialog(null)} addLabel="Brand">
      {brands.length ? <ul className="divide-y divide-slate-100">
        {brands.map((brand) => <li key={brand._id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/70">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{brand.name.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold text-slate-900">{brand.name}</span>{!brand.isActive && <Pill>Hidden</Pill>}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{count(brand.productCount)}{brand.website ? ` · ${brand.website.replace(/^https?:\/\//, '')}` : ''}</p>
          </div>
          {rowActions(() => setBrandDialog(brand), () => removeBrand(brand), brand.productCount > 0)}
        </li>)}
      </ul> : loaded && <EmptyState title="No brands yet" hint="Brands are optional but help customers filter." />}
    </Panel>

    <Modal open={categoryDialog !== false} onClose={() => setCategoryDialog(false)} title={editingCategory ? 'Edit category' : 'New category'}>
      <form onSubmit={saveCategory} className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Name" required defaultValue={editingCategory?.name || ''} />
        <Field name="slug" label="URL slug" defaultValue={editingCategory?.slug || ''} hint="Generated from the name if left empty." />
        <label className="label">Parent category<select name="parentId" defaultValue={editingCategory?.parentId || ''} className="input mt-1.5"><option value="">None (top level)</option>{categories.filter((category) => category._id !== editingCategory?._id).map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
        <Field name="displayOrder" label="Display order" type="number" defaultValue={String(editingCategory?.displayOrder ?? 0)} hint="Lower numbers appear first." />
        <label className="label sm:col-span-2">Description<textarea name="description" rows={2} defaultValue={editingCategory?.description || ''} className="input mt-1.5" /></label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" name="isActive" defaultChecked={editingCategory?.isActive ?? true} className="size-4 accent-emerald-700" />Visible on storefront</label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setCategoryDialog(false)} className="btn-secondary">Cancel</button><button className="btn-primary">Save category</button></div>
      </form>
    </Modal>

    <Modal open={brandDialog !== false} onClose={() => setBrandDialog(false)} title={editingBrand ? 'Edit brand' : 'New brand'}>
      <form onSubmit={saveBrand} className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Name" required defaultValue={editingBrand?.name || ''} />
        <Field name="slug" label="URL slug" defaultValue={editingBrand?.slug || ''} hint="Generated from the name if left empty." />
        <div className="sm:col-span-2"><Field name="website" label="Website" type="url" placeholder="https://" defaultValue={editingBrand?.website || ''} /></div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" name="isActive" defaultChecked={editingBrand?.isActive ?? true} className="size-4 accent-emerald-700" />Visible on storefront</label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setBrandDialog(false)} className="btn-secondary">Cancel</button><button className="btn-primary">Save brand</button></div>
      </form>
    </Modal>
  </div>;
}

function Panel({ icon, title, total, onAdd, addLabel, children }: { icon: ReactNode; title: string; total: number; onAdd: () => void; addLabel: string; children: ReactNode }) {
  return <section className="card overflow-hidden">
    <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">{icon}</span><h2 className="text-sm font-bold text-slate-950">{title} <span className="font-normal text-slate-400">{total}</span></h2></div>
      <button onClick={onAdd} className="btn-primary px-3 py-1.5"><Plus className="size-3.5" />{addLabel}</button>
    </header>
    {children}
  </section>;
}
