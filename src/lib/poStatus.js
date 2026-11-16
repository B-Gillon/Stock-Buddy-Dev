// /src/lib/poStatus.js
// The statuses a purchase order can be in, and the groups the app tests against.
//
//   draft                    not sent yet
//   pending_acknowledgement  sent; supplier must acknowledge (supplier has "acknowledgement required")
//   waiting_to_ship          sent and no acknowledgement needed, or it was acknowledged / the SFTP file was picked up
//   partially_received       some, not all, quantities received
//   received                 everything received
//   cancelled                cancelled
// (Partially Shipped / Shipped are planned for later.)

export const PO_STATUS = {
  DRAFT: 'draft',
  PENDING_ACK: 'pending_acknowledgement',
  WAITING_TO_SHIP: 'waiting_to_ship',
  PARTIALLY_RECEIVED: 'partially_received',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
};

/** Sent to the supplier, nothing received yet. */
export const SENT_STATUSES = ['pending_acknowledgement', 'waiting_to_ship'];

/** Can have goods received against it (and counts as incoming inventory). */
export const RECEIVABLE_STATUSES = [...SENT_STATUSES, 'partially_received'];

/** Still open: counts toward incoming quantities, can be cancelled. */
export const OPEN_STATUSES = ['draft', ...RECEIVABLE_STATUSES];

/** Can be resent to the supplier. */
export const RESENDABLE_STATUSES = [...RECEIVABLE_STATUSES, 'received'];

export const PO_STATUS_LABELS = {
  draft: 'Draft',
  pending_acknowledgement: 'Pending Acknowledgement',
  waiting_to_ship: 'Waiting to Ship',
  partially_received: 'Partially Received',
  received: 'Received',
  cancelled: 'Cancelled',
};
