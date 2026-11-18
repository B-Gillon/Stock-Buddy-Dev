// How a website user is named in History, "Created By", etc.: their username, or their email until one is set.
export const userLabel = (u) => (u?.username?.trim() || u?.email || 'Unknown');
