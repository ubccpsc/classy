import Log from "@common/Log";

/**
 * An admin previewing the Classy interface as another user.
 *
 * The admin stays authenticated as themselves; every request just carries a header naming who they
 * are acting as, and the backend decides whether that is allowed (see RouteUtil::resolveIdentity).
 * The student's token is never issued to the browser.
 */
export class ViewAs {
	private static readonly KEY = "viewAs";
	private static readonly LABEL_KEY = "viewAsLabel";
	public static readonly HEADER = "x-classy-view-as";

	/**
	 * The person being viewed as, or null.
	 */
	public static target(): string | null {
		try {
			const value = sessionStorage.getItem(ViewAs.KEY);
			return value === null || value === "" ? null : value;
		} catch (err) {
			// a browser with storage disabled simply cannot use the mode
			Log.warn("ViewAs::target() - sessionStorage unavailable: " + err.message);
			return null;
		}
	}

	public static isActive(): boolean {
		return ViewAs.target() !== null;
	}

	/**
	 * A human-readable name for the banner; falls back to the id.
	 */
	public static label(): string {
		try {
			return sessionStorage.getItem(ViewAs.LABEL_KEY) ?? ViewAs.target();
		} catch {
			return ViewAs.target();
		}
	}

	public static start(personId: string, label: string): void {
		Log.info("ViewAs::start( " + personId + " )");
		sessionStorage.setItem(ViewAs.KEY, personId);
		sessionStorage.setItem(ViewAs.LABEL_KEY, label);
	}

	public static stop(): void {
		Log.info("ViewAs::stop()");
		sessionStorage.removeItem(ViewAs.KEY);
		sessionStorage.removeItem(ViewAs.LABEL_KEY);
	}

	/**
	 * Adds the view-as header to a request when the mode is active.
	 */
	public static addHeader(headers: { [header: string]: string }): { [header: string]: string } {
		const target = ViewAs.target();
		if (target !== null) {
			headers[ViewAs.HEADER] = target;
		}
		return headers;
	}

	/**
	 * Draws the banner that says whose Classy this is.
	 *
	 * This is the most important part of the feature: an admin who forgets which student they are
	 * looking at is the thing it must not cause. It is deliberately not dismissible, appears on every
	 * page, and carries the only way out.
	 */
	public static renderBanner(onExit: () => void): void {
		const existing = document.querySelector("#viewAsBanner");
		if (ViewAs.isActive() === false) {
			if (existing !== null) {
				existing.remove();
			}
			return;
		}

		if (existing !== null) {
			return; // already showing; leave it alone so it does not flicker between pages
		}

		const banner = document.createElement("div");
		banner.id = "viewAsBanner";
		banner.style.position = "fixed";
		banner.style.top = "0";
		banner.style.left = "0";
		banner.style.right = "0";
		banner.style.zIndex = "10000";
		banner.style.backgroundColor = "#b00020";
		banner.style.color = "white";
		banner.style.padding = "0.6em 1em";
		banner.style.fontSize = "smaller";
		banner.style.display = "flex";
		banner.style.justifyContent = "space-between";
		banner.style.alignItems = "center";

		const text = document.createElement("span");
		text.innerHTML = "<b>Viewing as " + ViewAs.label() + ".</b> You are acting as this user; anything you do here is real.";

		const exit = document.createElement("button");
		exit.id = "viewAsExitButton";
		exit.textContent = "Return to admin";
		exit.style.marginLeft = "1em";
		exit.onclick = () => {
			ViewAs.stop();
			onExit();
		};

		banner.appendChild(text);
		banner.appendChild(exit);
		document.body.appendChild(banner);

		// so the banner never covers the page content it warns about
		document.body.style.paddingTop = banner.offsetHeight + "px";
	}
}
