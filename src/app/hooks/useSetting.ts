import { useCallback, useEffect, useState } from "react";
import {
	getSetting,
	onSettingChange,
	type SettingName,
	type SettingValue,
	setSetting,
} from "../../shared/settings/registry";

/** A setting as React state, kept in sync across the page and the extension. */
export function useSetting<K extends SettingName>(name: K): [SettingValue<K>, (v: SettingValue<K>) => void] {
	const [value, setValue] = useState(() => getSetting(name));
	useEffect(() => {
		setValue(getSetting(name));
		return onSettingChange(name, setValue);
	}, [name]);
	const update = useCallback((v: SettingValue<K>) => setSetting(name, v), [name]);
	return [value, update];
}
