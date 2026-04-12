============================================================
TABLE: tenants
============================================================
Columns:
• 	id — uuid — not null — default: gen_random_uuid()
• 	shop_domain — text — not null — unique
• 	shop_name — text — nullable
• 	access_token — text — nullable
• 	installed_at — timestamptz — nullable
• 	uninstalled_at — timestamptz — nullable
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
Relationships:
• 	Referenced by: products.tenant_id, variants.tenant_id, vendors.tenant_id, suppliers.tenant_id, supplier_addresses.tenant_id, supplier_variants.tenant_id, locations.tenant_id, inventory_items.tenant_id, inventory_levels.tenant_id, purchase_orders.tenant_id, purchase_order_lines.tenant_id, sync_status.tenant_id, settings.tenant_id, supplier_csv_settings.tenant_id, supplier_transmission_recipients.tenant_id, supplier_location_receiving_defaults.tenant_id, po_shopify_incoming.tenant_id, po_activity_log.tenant_id, variant_location_bins.tenant_id, location_contacts.tenant_id, third_party_logistics.tenant_id, error_log.tenant_id, beta_testers.tenant_id, beta_tester_sessions.tenant_id

============================================================
TABLE: inventory_items
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	shopify_inventory_item_id — bigint — not null
• 	variant_id — uuid — not null
• 	sku — text — nullable
• 	cost — numeric — nullable
• 	tracked — boolean — nullable — default: true
• 	country_code_of_origin — text — nullable
• 	harmonized_system_code — text — nullable
• 	requires_shipping — boolean — nullable — default: true
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
Relationships:
• 	variant_id → variants.id
• 	Referenced by: inventory_levels.inventory_item_id

============================================================
TABLE: inventory_levels
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	inventory_item_id — uuid — not null
• 	location_id — uuid — not null
• 	available — integer — nullable
• 	incoming — integer — nullable
• 	updated_at_shopify — timestamptz — nullable
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
Relationships:
• 	inventory_item_id → inventory_items.id
• 	location_id → locations.id

============================================================
TABLE: locations
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	name — text — not null
• 	active — boolean — nullable — default: true
• 	location_type — text — nullable
• 	address1 — text — nullable
• 	address2 — text — nullable
• 	city — text — nullable
• 	province — text — nullable
• 	country — text — nullable
• 	zip — text — nullable
• 	shipping_enabled — boolean — nullable — default: false
• 	local_delivery_enabled — boolean — nullable — default: false
• 	local_pickup_enabled — boolean — nullable — default: false
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
• 	shopify_location_id — bigint — nullable
• 	primary_name — text — nullable
• 	primary_phone — text — nullable
• 	primary_email — text — nullable
• 	warehouse_type — text — not null — default: 'retailer_owned'
• 	third_party_logistics_id — uuid — nullable — references third_party_logistics(id)
Constraints:
• 	warehouse_type ∈ ('retailer_owned','shipbob','deliverr','shiphero','flexport','other_3pl')
Relationships:
• 	Referenced by: inventory_levels.location_id
• 	Referenced by: supplier_location_receiving_defaults.location_id

============================================================
TABLE: third_party_logistics
============================================================
Columns:
• 	id — uuid — not null — default: gen_random_uuid()
• 	tenant_id — uuid — nullable — references tenants(id)
• 	name — text — not null
• 	code — text — not null — unique
• 	description — text — nullable
• 	created_at — timestamptz — not null — default: now()
• 	updated_at — timestamptz — not null — default: now()
Relationships:
• 	Referenced by: locations.third_party_logistics_id

============================================================
TABLE: products
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	shopify_product_id — bigint — not null
• 	title — text — nullable
• 	vendor_id — uuid — nullable
• 	product_type — text — nullable
• 	description — text — nullable
• 	image_src — text — nullable
• 	collection — text — nullable
• 	vendor — text — nullable
• 	option1_name — text — nullable
• 	option2_name — text — nullable
• 	option3_name — text — nullable
• 	handle — text — nullable
• 	status — text — nullable
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
• 	category — text — nullable
• 	display_title — text — nullable
• 	tags — text[] — nullable — default: {}
Relationships:
• 	vendor_id → vendors.id
• 	Referenced by: variants.product_id

============================================================
TABLE: sync_status
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	sync_type — text — not null
• 	last_synced_at — timestamptz — not null
Relationships:
• 	none

============================================================
TABLE: variants
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	shopify_variant_id — bigint — not null
• 	product_id — uuid — not null
• 	shopify_product_id — bigint — not null
• 	barcode — text — nullable
• 	title — text — nullable
• 	sku — text — nullable
• 	option1 — text — nullable
• 	option2 — text — nullable
• 	option3 — text — nullable
• 	price — text — nullable
• 	cost — numeric(12,4) — nullable
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
• 	image_src — text — nullable
• 	display_title — text — nullable
• 	compare_at_price — numeric — nullable
• 	inventory_quantity — integer — nullable
• 	taxable — boolean — nullable — default: true
• 	inventory_policy — text — nullable
• 	weight_value — numeric(10,3) — nullable
• 	weight_unit — varchar(10) — nullable
Relationships:
• 	product_id → products.id
• 	Referenced by: inventory_items.variant_id

============================================================
TABLE: vendors
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	name — text — not null
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
Relationships:
• 	Referenced by: products.vendor_id

============================================================
TABLE: suppliers
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	supplier_name — text — not null
• 	supplier_number — text — not null — unique
• 	ap_number — text — nullable
• 	company_name — text — not null
• 	contact_name — text — nullable
• 	contact_email — text — nullable
• 	po_email — text — nullable
• 	lead_days — integer — nullable
• 	currency — text — not null
• 	price_list — jsonb — nullable
• 	supplier_tax_type — text — nullable
• 	payment_terms — text — nullable
• 	payment_method — text — nullable
• 	phone — text — nullable
• 	phone_toll_free — text — nullable
• 	fax — text — nullable
• 	forecast_suggestion_period — integer — nullable
• 	website — text — nullable
• 	online_order_form — text — nullable
• 	username — text — nullable
• 	supplier_notes — text — nullable
• 	po_notes_template — text — nullable
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
Relationships:
• 	Referenced by: supplier_addresses.supplier_id
• 	Referenced by: supplier_variants.supplier_id
• 	Referenced by: purchase_orders.supplier_id
• 	Referenced by: supplier_location_receiving_defaults.supplier_id

============================================================
TABLE: supplier_addresses
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	supplier_id — uuid — not null
• 	address_type — text — not null — default: 'primary'
• 	address1 — text — not null
• 	address2 — text — nullable
• 	city — text — not null
• 	state_province — text — not null
• 	postal_code — text — not null
• 	country — text — not null
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
Relationships:
• 	supplier_id → suppliers.id

============================================================
TABLE: supplier_variants
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	supplier_id — uuid — not null
• 	variant_id — uuid — not null
• 	supplier_sku — text — nullable
• 	supplier_barcode — text — nullable
• 	item_code — text — nullable
• 	cost — numeric — nullable
• 	currency — text — nullable
• 	last_cost_update — timestamptz — nullable — default: now()
• 	moq — integer — nullable
• 	case_pack — integer — nullable
• 	inner_pack — integer — nullable
• 	order_increment — integer — nullable
• 	lead_days — integer — nullable
• 	initial_average_cost — numeric(12,4) — nullable
• 	notes — text — nullable
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
Constraints:
• 	unique (supplier_id, variant_id)
Relationships:
• 	supplier_id → suppliers.id
• 	variant_id → variants.id

============================================================
TABLE: purchase_orders
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	po_number — text — not null
• 	supplier_id — uuid — not null
• 	ship_to_location_id — uuid — nullable
• 	status — text — not null
• 	po_date — timestamptz — not null — default: now()
• 	expected_date — date — nullable
• 	currency_code — text — nullable — default: 'USD'
• 	notes_internal — text — nullable
• 	notes_supplier — text — nullable
• 	released_at — timestamptz — nullable
• 	cancelled_at — timestamptz — nullable
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
New Columns:
• 	receiving_source — text — not null — default: 'stock_buddy'
• 	auto_switched_to_external — boolean — not null — default: false
Constraints:
• 	receiving_source ∈ ('stock_buddy','external')
• 	status ∈ ('draft','held','released','partially_received','received','cancelled')
Relationships:
• 	supplier_id → suppliers.id
• 	ship_to_location_id → locations.id

============================================================
TABLE: purchase_order_lines
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	purchase_order_id — uuid — not null
• 	variant_id — uuid — not null
• 	supplier_variant_id — uuid — nullable
• 	line_no — integer — nullable
• 	sku — text — nullable
• 	title — text — nullable
• 	case_pack_qty — integer — nullable
• 	unit_cost — numeric(12,4) — nullable
• 	order_qty_units — integer — not null
• 	order_qty_cases — integer — nullable
• 	extended_cost — numeric(12,4) — nullable
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
• 	received_qty_units — integer — nullable
• 	received_at — timestamptz — nullable
• 	incoming_qty — integer — not null — default: 0
• 	incoming_remaining — integer — not null — default: 0
Relationships:
• 	purchase_order_id → purchase_orders.id
• 	variant_id → variants.id
• 	supplier_variant_id → supplier_variants.id

============================================================
TABLE: supplier_location_receiving_defaults
============================================================
Columns:
• 	id — uuid — not null — default: gen_random_uuid()
• 	tenant_id — uuid — nullable — references tenants(id)
• 	supplier_id — uuid — not null — references suppliers(id)
• 	location_id — uuid — not null — references locations(id)
• 	default_receiving_source — text — not null
CHECK (default_receiving_source IN ('stock_buddy','external'))
• 	created_at — timestamptz — not null — default: now()
• 	updated_at — timestamptz — not null — default: now()
Constraints:
• 	UNIQUE (supplier_id, location_id)

============================================================
TABLE: settings
============================================================
Columns:
• 	tenant_id — uuid — nullable — references tenants(id)
• 	id — uuid — not null — default: gen_random_uuid()
• 	key — text — not null — unique
• 	value — text — nullable
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
Relationships:
• 	none

============================================================
TABLE: supplier_csv_settings
============================================================
Columns:
• 	id — uuid — not null — default: gen_random_uuid()
• 	tenant_id — uuid — nullable — references tenants(id)
• 	supplier_id — uuid — not null — unique — references suppliers(id)
• 	use_global — boolean — not null — default: true
• 	po_number — boolean — not null — default: true
• 	supplier_name — boolean — not null — default: true
• 	ship_to_name — boolean — not null — default: true
• 	ship_to_address — boolean — not null — default: true
• 	po_date — boolean — not null — default: true
• 	expected_date — boolean — not null — default: true
• 	notes_supplier — boolean — not null — default: true
• 	line_no — boolean — not null — default: true
• 	sku — boolean — not null — default: true
• 	title — boolean — not null — default: true
• 	quantity — boolean — not null — default: true
• 	unit_cost — boolean — not null — default: true
• 	supplier_sku — boolean — not null — default: false
• 	barcode — boolean — not null — default: true
• 	extended_cost — boolean — not null — default: false
• 	bin_location — boolean — not null — default: false
• 	product_tags — boolean — not null — default: false
• 	weight_value — boolean — not null — default: false
• 	total_weight — boolean — not null — default: false
• 	weight_unit — boolean — not null — default: false
• 	retail_price — boolean — not null — default: false
• 	current_stock — boolean — not null — default: false
• 	total_stock_all_locations — boolean — not null — default: false
• 	created_at — timestamptz — nullable — default: now()
• 	updated_at — timestamptz — nullable — default: now()
Relationships:
• 	supplier_id → suppliers.id
• 	tenant_id → tenants(id)

============================================================
TABLE: supplier_transmission_recipients
============================================================
Columns:
- 	id — uuid — not null — default: gen_random_uuid()
- 	tenant_id — uuid — nullable — references tenants(id)
- 	supplier_id — uuid — not null — references suppliers(id)
- 	label — text — not null
- 	to_emails — text — not null
- 	cc_emails — text — nullable
- 	bcc_emails — text — nullable
- 	send_pdf — boolean — not null — default: true
- 	send_csv — boolean — not null — default: true
- 	sort_order — integer — not null — default: 0
- 	created_at — timestamptz — nullable — default: now()
- 	updated_at — timestamptz — nullable — default: now()
Relationships:
- 	supplier_id → suppliers.id
- 	tenant_id → tenants(id)

============================================================
TABLE: po_shopify_incoming
============================================================
Columns:
• 	id — uuid — not null — default: gen_random_uuid()
• 	tenant_id — uuid — nullable — references tenants(id)
• 	purchase_order_id — uuid — not null
• 	purchase_order_line_id — uuid — nullable
• 	variant_id — uuid — nullable
• 	shopify_inventory_item_id — bigint — nullable
• 	shopify_location_id — bigint — nullable
• 	quantity_pushed — integer — nullable
• 	incoming_qty — integer — nullable
• 	action — text — nullable
• 	last_known_available — integer — nullable
• 	pushed_at — timestamptz — nullable
• 	reversed_at — timestamptz — nullable
• 	reversal_reason — text — nullable
Relationships:
• 	purchase_order_id → purchase_orders.id
• 	tenant_id → tenants(id)

============================================================
TABLE: po_activity_log
============================================================
Columns:
-   id — uuid — not null — default: gen_random_uuid()
-   tenant_id — uuid — nullable — references tenants(id)
-   po_id — uuid — not null — references purchase_orders(id)
-   action — text — not null
-   comments — text — nullable
-   created_at — timestamptz — not null — default: now()
Constraints:
-   action ∈ ('created','edited','released','resent','cancelled','closed','error')
Relationships:
-   po_id → purchase_orders.id
-   tenant_id → tenants(id)

============================================================
TABLE: variant_location_bins
============================================================
Columns:
• id — uuid — not null — default: gen_random_uuid()
• tenant_id — uuid — nullable — references tenants(id)
• variant_id — uuid — not null — references variants(id)
• location_id — uuid — not null — references locations(id)
• bin_location — text — nullable — e.g., "Aisle 3 / Bay 2" or "44‑C"
• created_at — timestamptz — not null — default: now()
• updated_at — timestamptz — not null — default: now()
Constraints:
• unique (variant_id, location_id)
Indexes:
• index on (variant_id, location_id)
Relationships:
• variant_id → variants.id
• location_id → locations.id
• tenant_id → tenants.id

============================================================
TABLE: location_contacts
============================================================
Columns:
-   id — uuid — not null — default: gen_random_uuid()
-   tenant_id — uuid — nullable — references tenants(id)
-   location_id — uuid — not null — references locations(id)
-   name — text — not null
-   phone — text — nullable
-   email — text — nullable
-   role — text — nullable
-   is_primary — boolean — not null — default: false
-   created_at — timestamptz — nullable — default: now()
-   updated_at — timestamptz — nullable — default: now()
Relationships:
-   location_id → locations.id
-   tenant_id → tenants(id)
-   Referenced by: nothing currently

============================================================
TABLE: error_log
============================================================
Columns:
-   id — uuid — not null — default: gen_random_uuid()
-   tenant_id — uuid — null — references tenants(id)
-   source — text — not null
-   message — text — not null
-   stack — text — null
-   context — jsonb — null
-   created_at — timestamptz — not null — default: now()
Indexes:
-   index on (tenant_id)
-   index on (created_at DESC)
-   index on (source)
Relationships:
-   tenant_id → tenants(id)
-   Referenced by: nothing currently

============================================================
TABLE: beta_testers
============================================================
Columns:
-   id — uuid — not null — default: gen_random_uuid()
-   tenant_id — uuid — null — references tenants(id)
-   contact_name — text — not null
-   contact_email — text — null
-   contact_phone — text — null
-   notes — text — null
-   shopify_domain — text — null
-   store_name — text — null
-   owner_name — text — null
-   owner_email — text — null
-   is_active — boolean — not null — default: true
-   invited_at — timestamptz — not null — default: now()
-   installed_at — timestamptz — null
-   connected_at — timestamptz — null
-   created_at — timestamptz — not null — default: now()
-   updated_at — timestamptz — not null — default: now()
Indexes:
-   index on (tenant_id)
-   index on (shopify_domain)
Relationships:
-   tenant_id → tenants(id)
-   Referenced by: nothing currently

============================================================
TABLE: beta_tester_sessions
============================================================
Columns:
-   id — uuid — not null — default: gen_random_uuid()
-   tenant_id — uuid — not null — references tenants(id)
-   accessed_at — timestamptz — not null — default: now()
-   path — text — null
Indexes:
-   index on (tenant_id)
-   index on (accessed_at DESC)
Relationships:
-   tenant_id → tenants(id)
-   Referenced by: nothing currently
