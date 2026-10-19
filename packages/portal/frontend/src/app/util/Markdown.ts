import DOMPurify = require("dompurify");

import { marked } from "marked";

/**
 * Renders Markdown written by course staff (grade comments, for one) as HTML that is safe to put
 * in the page.
 *
 * The text is treated as GitHub-flavoured Markdown with single newlines kept as line breaks, so a
 * plain-text comment keeps the layout it was typed with and a Markdown one gets headings, lists,
 * tables and code blocks. Whatever comes out of marked is then sanitised, because the comment may
 * have been uploaded from a spreadsheet or written by a grader script: scripts, event handlers and
 * the like are removed, and links are made to open in a new tab so the student does not lose the
 * portal page.
 */
export class Markdown {
	private static hooked = false;

	public static render(text: string): string {
		Markdown.installHooks();
		const html = marked.parse(text ?? "", { gfm: true, breaks: true, async: false }) as string;
		return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
	}

	private static installHooks(): void {
		if (Markdown.hooked === true) {
			return;
		}
		DOMPurify.addHook("afterSanitizeAttributes", function (node: Element) {
			if (node.tagName === "A" && node.hasAttribute("href") === true) {
				node.setAttribute("target", "_blank");
				node.setAttribute("rel", "noopener noreferrer");
			}
		});
		Markdown.hooked = true;
	}
}
