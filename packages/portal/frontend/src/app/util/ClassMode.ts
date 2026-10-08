import Log from "@common/Log";

/**
 * Class mode: an admin projecting the portal in a lecture, with who-is-who hidden.
 *
 * While it is on, the Students and Teams tabs are hidden (AdminView), the grades page shows only its
 * summary (AdminGradesTab), and the results and dashboard tables drop their subject column -- the
 * repository, or the GitHub id where a course plugin relabels it -- along with the filter that lists
 * the same values (AdminResultsTab, AdminDashboardTab). Only admins are offered the toggle.
 *
 * NOTE: a display mode, not access control. The same data still reaches the browser; the grades
 * summary is computed from per-student grades, for one. It keeps names off a projector, nothing more.
 *
 * Held per browser tab, in sessionStorage: it survives a reload of the tab being projected, so an
 * accidental refresh cannot reveal anything, but it does not follow the admin into another window.
 * Logging out clears it.
 */
export class ClassMode {
	private static readonly KEY = "classyClassMode";

	/**
	 * The results and dashboard column that says whose row it is: Classy's Repository column, which
	 * the cs210 plugin relabels GitHub Id but keeps under the same id.
	 */
	public static readonly SUBJECT_COLUMN = "repoId";

	/** Used when sessionStorage is unavailable (blocked, or a private window that refuses it). */
	private static fallback = false;

	public static isOn(): boolean {
		try {
			return sessionStorage.getItem(ClassMode.KEY) === "true";
		} catch (_err) {
			return ClassMode.fallback;
		}
	}

	public static set(on: boolean): void {
		ClassMode.fallback = on;
		try {
			if (on === true) {
				sessionStorage.setItem(ClassMode.KEY, "true");
			} else {
				sessionStorage.removeItem(ClassMode.KEY);
			}
		} catch (err) {
			Log.warn("ClassMode::set( " + on + " ) - sessionStorage unavailable; this page only. ERROR: " + err?.message);
		}
	}

	public static clear(): void {
		ClassMode.set(false);
	}

	/**
	 * Shows or hides an element for class mode, restoring exactly the inline display it had.
	 *
	 * Neither "" nor the UI helpers' "inherit" is a safe way back: several of these elements carry
	 * their own inline display (a select is display: flex), and Onsen lays list items out with its
	 * own. So the value is remembered on the element when it is hidden, and put back when shown.
	 */
	public static show(el: HTMLElement | null, visible: boolean): void {
		if (el === null) {
			return;
		}
		if (visible === true) {
			if (typeof el.dataset.classModeDisplay === "string") {
				el.style.display = el.dataset.classModeDisplay;
				delete el.dataset.classModeDisplay;
			}
		} else if (typeof el.dataset.classModeDisplay !== "string") {
			el.dataset.classModeDisplay = el.style.display;
			el.style.display = "none";
		}
	}

	/**
	 * Shows or hides a results or dashboard filter: its label, its select, and the searchable
	 * TomSelect widget that stands in for the select on screen. Hiding the select alone would leave
	 * the widget, which is a separate element beside it, still showing.
	 */
	public static showFilter(labelId: string, selectId: string, visible: boolean): void {
		ClassMode.show(document.getElementById(labelId), visible);
		const select = document.getElementById(selectId);
		ClassMode.show(select, visible);
		const widget = (select as any)?.tomselect?.wrapper as HTMLElement | undefined;
		ClassMode.show(widget ?? null, visible);
	}
}
