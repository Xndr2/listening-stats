export type AppErrorVariant =
	| "UserNotFound"
	| "NetworkError"
	| "ServiceDown"
	| "RateLimited"
	| "InvalidApiKey"
	| "Unknown";

export interface AppError {
	variant: AppErrorVariant;
	message: string;
	retryable: boolean;
	resetAt?: number;
}

export class StatsFmError extends Error {
	readonly appError: AppError;
	constructor(appError: AppError) {
		super(appError.message);
		this.name = "StatsFmError";
		this.appError = appError;
	}
}

export function classifyStatsFmError(status: number, message: string, resetAt?: number): AppError {
	if (status === 404) {
		return { variant: "UserNotFound", message, retryable: false };
	}
	if (status === 429 || (status === 0 && message.includes("Circuit open"))) {
		return { variant: "RateLimited", message, retryable: false, resetAt };
	}
	if (status >= 500 && status <= 599) {
		return { variant: "ServiceDown", message, retryable: true };
	}
	if (status === 0) {
		return { variant: "NetworkError", message, retryable: true };
	}
	return { variant: "Unknown", message, retryable: true };
}
