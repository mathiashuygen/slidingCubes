import { renderToString } from "katex";
import "katex/dist/katex.min.css";

/** Report formulas are authored in LaTeX and typeset at build time. */
export function Math({ tex, display = false }: { tex: string; display?: boolean }) {
	const html = renderToString(tex, { displayMode: display, output: "htmlAndMathml" });
	return display
		? <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
		: <span dangerouslySetInnerHTML={{ __html: html }} />;
}
