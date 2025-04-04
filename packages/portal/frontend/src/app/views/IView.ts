export interface IView {
	renderPage(pageName: string, opts: {}): void;

	pushPage(pageName: string, opts: {}): void;
}
