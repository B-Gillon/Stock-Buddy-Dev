// /src/app/api/locations/[slug]/contacts/route.js
import { supabase, setTenantContext } from "@/lib/supabaseClient";
import { getTenantId } from "@/lib/tenants";
import { NextResponse } from "next/server";

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

async function getLocationId(slug) {
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name");
  const location = (locations ?? []).find((l) => toSlug(l.name) === slug);
  return location?.id ?? null;
}

export async function GET(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { slug } = await params;
  const locationId = await getLocationId(slug);
  if (!locationId) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("location_contacts")
    .select("*")
    .eq("location_id", locationId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data });
}

export async function POST(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { slug } = await params;
  const locationId = await getLocationId(slug);
  if (!locationId) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { name, phone, email, role, is_primary } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  if (is_primary) {
    await supabase
      .from("location_contacts")
      .update({ is_primary: false })
      .eq("location_id", locationId);
  }

  const { data, error } = await supabase
    .from("location_contacts")
    .insert({
      location_id: locationId,
      name:        name.trim(),
      phone:       phone?.trim() || null,
      email:       email?.trim() || null,
      role:        role?.trim()  || null,
      is_primary:  is_primary ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data }, { status: 201 });
}

export async function PATCH(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { slug } = await params;
  const locationId = await getLocationId(slug);
  if (!locationId) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id, name, phone, email, role, is_primary } = body;
  if (!id) return NextResponse.json({ error: "Contact id is required" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  if (is_primary) {
    await supabase
      .from("location_contacts")
      .update({ is_primary: false })
      .eq("location_id", locationId)
      .neq("id", id);
  }

  const { data, error } = await supabase
    .from("location_contacts")
    .update({
      name:       name.trim(),
      phone:      phone?.trim() || null,
      email:      email?.trim() || null,
      role:       role?.trim()  || null,
      is_primary: is_primary ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("location_id", locationId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

export async function DELETE(request, { params }) {
  const tenantId = await getTenantId(request);
  await setTenantContext(supabase, tenantId);

  const { slug } = await params;
  const locationId = await getLocationId(slug);
  if (!locationId) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id } = body;
  if (!id) return NextResponse.json({ error: "Contact id is required" }, { status: 400 });

  const { error } = await supabase
    .from("location_contacts")
    .delete()
    .eq("id", id)
    .eq("location_id", locationId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
