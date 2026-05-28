// Module-level signal used to tell the Add tab to reset its form when the
// "+" tab button is tapped. URL-param-based signaling proved unreliable in
// expo-router tabs (params persist across tab switches), so we use a plain
// mutable object that the button writes and the screen reads on focus.
export const addFormSignal: { resetPending: boolean } = { resetPending: false };
