/**
 * DOM attributes React 18's types don't know yet. React 18 passes unknown
 * lowercase attributes straight to the DOM, so these work at runtime.
 */
import "react";

declare module "react" {
	interface HTMLAttributes<T> {
		popover?: "auto" | "manual" | "";
	}
	interface ButtonHTMLAttributes<T> {
		popovertarget?: string;
		popovertargetaction?: "toggle" | "show" | "hide";
	}
}
