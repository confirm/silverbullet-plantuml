/**
 * SilverBullet PlantUML plug.
 *
 * Renders PlantUML code blocks as SVG inside SilverBullet pages. Diagrams can
 * be generated either by a remote PlantUML server (default) or a local
 * executable, depending on the user's `plantuml` config entry.
 *
 * The exported {@link widget} function is the entry point referenced from
 * `plantuml.plug.yml`; everything else is internal implementation.
 *
 * @module
 */

import { shell, system } from "@silverbulletmd/silverbullet/syscalls";
import plantumlEncoder from "plantuml-encoder";

/**
 * User-supplied configuration read from SilverBullet's `plantuml` config key.
 *
 * Exactly one of the fields should be set. If both are present, `serverURL`
 * wins (see {@link RendererFactory.fromConfig}).
 */
interface PlantUmlConfig {
    /** URL of a PlantUML server, e.g. `https://plantuml.com/plantuml`. */
    serverURL?: string;
    /** Path to a local executable that accepts base64-encoded UML on argv. */
    executable?: string;
}

/**
 * Base class for PlantUML rendering strategies.
 *
 * Subclasses implement {@link renderHtml} to turn UML source into a chunk of
 * HTML for the widget body. Errors are funneled through {@link handleError}
 * so a failed render returns a human-readable message instead of throwing —
 * the result is embedded directly into the widget's HTML.
 */
abstract class PlantUmlRenderer {
    /**
     * Render PlantUML source to a self-contained HTML fragment.
     *
     * @param uml Raw PlantUML source (the body of the code block).
     * @returns HTML markup on success, or an error message on failure.
     */
    abstract renderHtml(uml: string): Promise<string>;

    /**
     * Log an error and convert it to a string for inline display.
     *
     * @param error The thrown value (may not be an `Error` instance).
     * @returns A string representation suitable for embedding in the widget.
     */
    protected handleError(error: unknown): string {
        console.error("PUML generation failed", error);
        return String(error);
    }
}

/**
 * Renders diagrams by invoking a local executable via SilverBullet's
 * `shell.run` syscall. Requires the `shell` permission in `plantuml.plug.yml`.
 *
 * The UML source is base64-encoded before being passed as the sole argument,
 * matching the contract expected by typical PlantUML wrapper scripts. The
 * executable must print the resulting SVG to stdout, which is inlined into
 * the widget.
 */
class LocalRenderer extends PlantUmlRenderer {
    /**
     * @param executable Path or name of the executable to run.
     */
    constructor(private readonly executable: string) {
        super();
    }

    async renderHtml(uml: string): Promise<string> {
        try {
            const encoded = btoa(uml);
            const { stdout, stderr } = await shell.run(this.executable, [encoded]);
            if (stderr) console.log(stderr);
            return `<pre id="plantuml">${stdout}</pre>`;
        } catch (error) {
            return `<pre id="plantuml">${this.handleError(error)}</pre>`;
        }
    }
}

/**
 * Renders diagrams against a remote PlantUML HTTP server.
 *
 * The plug does **not** fetch the SVG itself — it only builds the URL and
 * emits an `<img>` tag pointing at it. The browser then loads the asset
 * directly, which means:
 *
 *   - SilverBullet's server-side HTTP proxy is bypassed (important when the
 *     PlantUML server is gated by mTLS — the user's browser presents the
 *     client cert, not the SilverBullet server).
 *   - No `fetch` permission is needed at runtime for server mode.
 *
 * The UML is encoded with `plantuml-encoder` (PlantUML's custom DEFLATE +
 * base64 variant), not plain base64.
 */
class ServerRenderer extends PlantUmlRenderer {
    /**
     * @param serverURL Base URL of the PlantUML server. A trailing slash is
     *                  optional and handled in {@link buildUrl}.
     */
    constructor(private readonly serverURL: string) {
        super();
    }

    /**
     * Build the full SVG endpoint URL for a piece of UML source.
     *
     * @param uml Raw PlantUML source.
     * @returns A URL of the form `<serverURL>/svg/<encoded>`.
     */
    private buildUrl(uml: string): string {
        const encoded = plantumlEncoder.encode(uml);
        const sep = this.serverURL.endsWith("/") ? "" : "/";
        return `${this.serverURL}${sep}svg/${encoded}`;
    }

    renderHtml(uml: string): Promise<string> {
        try {
            const url = this.buildUrl(uml);
            return Promise.resolve(`<img id="plantuml" src="${url}" alt="PlantUML diagram">`);
        } catch (error) {
            return Promise.resolve(`<pre id="plantuml">${this.handleError(error)}</pre>`);
        }
    }
}

/**
 * Selects and constructs the appropriate {@link PlantUmlRenderer} from user
 * configuration.
 */
class RendererFactory {
    /**
     * Build a renderer based on which config field is populated.
     *
     * `serverURL` is preferred when both are set, so users can override a
     * locally configured executable by adding a server URL.
     *
     * @param config Parsed user config.
     * @returns A renderer instance, or `null` if no usable config was found.
     */
    static fromConfig(config: PlantUmlConfig): PlantUmlRenderer | null {
        if (config.serverURL) return new ServerRenderer(config.serverURL);
        if (config.executable) return new LocalRenderer(config.executable);
        return null;
    }
}

/**
 * Top-level orchestrator that loads config, dispatches to a renderer, and
 * wraps the rendered HTML in the payload SilverBullet expects from a code
 * widget.
 */
class PlantUmlWidget {
    /** Fallback used when the user has no `plantuml` config entry at all. */
    private static readonly DEFAULT_CONFIG: PlantUmlConfig = {
        serverURL: "https://plantuml.com/plantuml",
    };

    /**
     * Render a PlantUML code block to a SilverBullet widget payload.
     *
     * @param bodyText The raw contents of the ```plantuml code block.
     * @returns An object with `html` (the rendered diagram) and `script`
     *          (a click-to-blur handler that returns to source mode).
     */
    async render(bodyText: string): Promise<{ html: string; script: string }> {
        const config = await system.getConfig<PlantUmlConfig>(
            "plantuml",
            PlantUmlWidget.DEFAULT_CONFIG,
        );
        const renderer = RendererFactory.fromConfig(config);

        let html: string;
        if (renderer) {
            html = await renderer.renderHtml(bodyText);
        } else {
            console.error("silverbullet-plantuml: Configure either serverURL or executable");
            html = `<pre id="plantuml">${bodyText}</pre>`;
        }

        return {
            html,
            script: `
                document.addEventListener("click", () => {
                    api({type: "blur"});
                });
            `,
        };
    }
}

/**
 * Plug entry point invoked by SilverBullet for every ```plantuml code block.
 *
 * Wired up in `plantuml.plug.yml` as the `plantumlWidget` code widget. Kept
 * as a thin function so the plug manifest doesn't need to know about the
 * underlying class structure.
 *
 * @param bodyText Raw text inside the code block.
 * @returns The widget payload (HTML + companion script).
 */
export function widget(bodyText: string) {
    return new PlantUmlWidget().render(bodyText);
}
