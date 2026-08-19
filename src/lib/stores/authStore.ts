/**
 * Admin session state for the map app footer.
 *
 * The admin login (see backend/munimap/admin) stores a Bearer token in
 * sessionStorage under `admin_token`. sessionStorage is per-tab, so the footer
 * reflects the login state only within a tab where the admin logged in (e.g.
 * Login → back to the map in the same tab). Because sessionStorage does not
 * emit `storage` events in the same tab, callers should call refresh() on mount
 * and when the tab regains focus (see Sidebar.svelte).
 *
 * There is no real per-user identity yet (Phase 8.2); a logged-in admin is
 * shown with a fixed label.
 */
import { writable, derived } from 'svelte/store';

const ADMIN_TOKEN_KEY = 'admin_token';

interface AuthState {
	token: string | null;
}

function readToken(): string | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		return sessionStorage.getItem(ADMIN_TOKEN_KEY);
	} catch {
		return null;
	}
}

function createAuthStore() {
	const { subscribe, set } = writable<AuthState>({ token: readToken() });

	return {
		subscribe,

		/** Re-read the token from sessionStorage (e.g. after returning from the admin login). */
		refresh() {
			set({ token: readToken() });
		},

		/**
		 * Verify a token against the backend and store it on success.
		 * Returns true when the token was accepted.
		 */
		async login(token: string): Promise<boolean> {
			const res = await fetch('/admin/api/verify', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) return false;

			if (typeof sessionStorage !== 'undefined') {
				try {
					sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
				} catch {
					/* ignore */
				}
			}
			set({ token });
			return true;
		},

		logout() {
			if (typeof sessionStorage !== 'undefined') {
				try {
					sessionStorage.removeItem(ADMIN_TOKEN_KEY);
				} catch {
					/* ignore */
				}
			}
			set({ token: null });
		}
	};
}

export const authStore = createAuthStore();

export const isLoggedIn = derived(authStore, ($a) => !!$a.token);

/** Display name for a logged-in admin (no real user identity until Phase 8.2). */
export const userName = derived(authStore, () => 'Admin');
