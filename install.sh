#!/usr/bin/env bash
# Listening Stats  -  install or update for Spicetify (macOS / Linux).
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.sh | bash
# Opt in to prereleases (only used when strictly newer than the latest stable release):
#   LISTENING_STATS_PRERELEASE=1 curl -fsSL … | bash
#
# If Spicetify CLI is missing, installs it to ~/.spicetify (non-interactive; no Marketplace).
# Set LISTENING_STATS_SKIP_SPICETIFY_INSTALL=1 to only install LS (fail if spicetify missing).
#
# Downloads listening-stats.zip from GitHub Releases. Default: latest stable release;
# prereleases are always skipped. With LISTENING_STATS_PRERELEASE=1, a prerelease is
# installed only when its version is newer than the newest stable release — otherwise
# the stable release still wins. Requires jq or python3 for the prerelease path.
#
# Installs into the **user-config** CustomApps directory (where `spicetify apply` reads from
# first), then wipes any stale `listening-stats` copies in the CLI exe-dir CustomApps and any
# Spicetify-resolved path so the loader cannot pick up an old version. Auto-recovers from a
# stale backup ("Preprocessed Spotify data is outdated") by chaining `spicetify backup apply`.

set -euo pipefail

REPO_SLUG="Xndr2/listening-stats"
APP_NAME="listening-stats"
MIN_ZIP_BYTES=2000

# Scan recent releases for the newest one that actually ships listening-stats.zip.
# Stable mode (default): only non-prerelease releases are considered — prereleases
# are always skipped. Prerelease mode (LISTENING_STATS_PRERELEASE=1): a prerelease
# is only picked when its version is strictly newer than the newest stable release
# (a stable 2.1.0 beats its own 2.1.0-beta.N and anything older); otherwise the
# stable release wins, so the flag is safe even when no prereleases exist yet.
# Requires jq or python3; otherwise stable mode uses the static latest-download
# URL and prerelease mode errors out.
resolve_zip_url() {
	local slug="$1"
	local want_pre="${LISTENING_STATS_PRERELEASE:-}"
	local api_url="https://api.github.com/repos/${slug}/releases?per_page=20"
	local json="" url=""

	if json="$(curl -sSf -H "Accept: application/vnd.github+json" "${api_url}" 2>/dev/null)"; then
		if command -v jq >/dev/null 2>&1; then
			url="$(printf '%s' "${json}" | jq -r --arg want_pre "${want_pre}" '
				def core: (.tag_name // "" | sub("^[vV]"; "") | split("+")[0] | split("-")[0]
				           | split(".") | map(tonumber? // 0));
				[ .[] | select(.draft != true)
				| select(((.assets // []) | map(.name) | index("listening-stats.zip")) != null) ] as $all
				| ($all | map(select(.prerelease != true)) | first) as $stable
				| ($all | map(select(.prerelease == true)) | first) as $prerel
				| (if $want_pre != "1" then $stable
				   elif $stable == null then $prerel
				   elif $prerel == null then $stable
				   elif ($prerel | core) > ($stable | core) then $prerel
				   else $stable end)
				| select(. != null)
				| .assets[] | select(.name == "listening-stats.zip") | .browser_download_url
			' 2>/dev/null | head -n1)"
		elif command -v python3 >/dev/null 2>&1; then
			url="$(printf '%s' "${json}" | LISTENING_STATS_PRERELEASE="${want_pre}" python3 -c '
import json, os, re, sys
data = json.load(sys.stdin)
want_pre = os.environ.get("LISTENING_STATS_PRERELEASE") == "1"

def core(rel):
    v = re.sub(r"^[vV]", "", rel.get("tag_name") or "")
    v = v.split("+")[0].split("-")[0]
    return tuple(int(p) if p.isdigit() else 0 for p in v.split("."))

with_zip = [r for r in data
            if not r.get("draft")
            and any(a.get("name") == "listening-stats.zip" for a in r.get("assets") or [])]
stable = next((r for r in with_zip if not r.get("prerelease")), None)
prerel = next((r for r in with_zip if r.get("prerelease")), None)
if not want_pre:
    pick = stable
elif stable is None:
    pick = prerel
elif prerel is not None and core(prerel) > core(stable):
    pick = prerel
else:
    pick = stable
if pick:
    for a in pick["assets"]:
        if a.get("name") == "listening-stats.zip":
            print(a["browser_download_url"])
            break
' 2>/dev/null)"
		fi
	fi

	if [[ -n "${url}" && "${url}" != "null" ]]; then
		printf '%s\n' "${url}"
		return 0
	fi

	if [[ "${want_pre}" == "1" ]]; then
		if ! command -v jq >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
			echo "! LISTENING_STATS_PRERELEASE=1 requires jq or python3." >&2
		else
			echo "! No GitHub release includes listening-stats.zip (or the GitHub API is unreachable)." >&2
			echo "! Check https://github.com/${slug}/releases" >&2
		fi
		exit 1
	fi

	# GitHub API unreachable or no parser available: last-resort static URL.
	printf '%s\n' "https://github.com/${slug}/releases/latest/download/listening-stats.zip"
}

if [[ -t 1 ]]; then
	BOLD=$'\033[1m'
	DIM=$'\033[2m'
	GRN=$'\033[32m'
	CYN=$'\033[36m'
	YEL=$'\033[33m'
	RST=$'\033[0m'
else
	BOLD="" DIM="" GRN="" CYN="" YEL="" RST=""
fi

rule() {
	printf '%s\n' "${DIM}────────────────────────────────────────────────────────────────${RST}"
}

banner() {
	echo ""
	rule
	echo "${CYN}${BOLD}  Listening Stats${RST}  ${DIM}·${RST}  install / update"
	echo "${DIM}  Spicetify custom app${RST}"
	rule
	echo ""
}

step() {
	echo "${GRN}${BOLD}▸${RST} ${BOLD}$1${RST}"
}

detail() {
	echo "   ${DIM}$1${RST}"
}

warn() {
	echo "   ${YEL}$1${RST}" >&2
}

die() {
	echo "${YEL}${BOLD}!${RST} $1" >&2
	exit 1
}

# Run spicetify, capture stdout+stderr and exit code without aborting under set -e.
# Sets globals SPC_OUT and SPC_RC.
spicetify_run() {
	SPC_OUT=""
	SPC_RC=0
	if ! command -v spicetify >/dev/null 2>&1; then
		SPC_RC=127
		return 0
	fi
	# shellcheck disable=SC2034
	if SPC_OUT="$(spicetify "$@" 2>&1)"; then
		SPC_RC=0
	else
		SPC_RC=$?
	fi
	return 0
}

# First non-empty trimmed line of `spicetify <args...>` output, or empty string on failure.
spicetify_path_line() {
	spicetify_run "$@"
	if [[ "${SPC_RC}" -ne 0 ]]; then
		printf '%s' ""
		return 0
	fi
	printf '%s' "${SPC_OUT}" | head -1 | tr -d '\r'
}

# Where `spicetify apply` looks for custom apps FIRST (see spicetify/cli src/utils/path-utils.go
# GetCustomAppPath -> userAppsFolder).
#  1. SPICETIFY_CONFIG env var if set.
#  2. parent of `spicetify path -c` (config-xpui.ini) — authoritative when CLI is on PATH.
#  3. XDG_CONFIG_HOME or ~/.config (Linux/macOS) — matches GetSpicetifyFolder() defaults.
resolve_user_config_custom_apps() {
	if [[ -n "${SPICETIFY_CONFIG:-}" && -d "${SPICETIFY_CONFIG}" ]]; then
		printf '%s' "${SPICETIFY_CONFIG}/CustomApps"
		return 0
	fi
	if command -v spicetify >/dev/null 2>&1; then
		local cfg_ini
		cfg_ini="$(spicetify_path_line path -c)"
		if [[ -n "${cfg_ini}" && -f "${cfg_ini}" ]]; then
			printf '%s' "$(dirname "${cfg_ini}")/CustomApps"
			return 0
		fi
	fi
	local parent
	if [[ -n "${XDG_CONFIG_HOME:-}" ]]; then
		parent="${XDG_CONFIG_HOME}"
	else
		parent="${HOME}/.config"
	fi
	printf '%s' "${parent}/spicetify/CustomApps"
}

# The CLI's bundled CustomApps root (used as a *fallback* by GetCustomAppPath when the
# user-config dir does not contain the app). We only want to *clean* this location.
resolve_exe_dir_custom_apps() {
	if ! command -v spicetify >/dev/null 2>&1; then
		printf '%s' ""
		return 0
	fi
	local exe_path
	exe_path="$(spicetify_path_line path)"
	if [[ -n "${exe_path}" && -f "${exe_path}" ]]; then
		printf '%s' "$(dirname "${exe_path}")/CustomApps"
		return 0
	fi
	local alt
	alt="$(spicetify_path_line path -a root)"
	if [[ -n "${alt}" && -d "${alt}" ]]; then
		printf '%s' "${alt}"
		return 0
	fi
	printf '%s' ""
}

# Whatever path `spicetify path -a <name>` returns — accounts for env-var overrides and any
# quirky resolution. Empty if not currently installed/configured.
resolve_spicetify_resolved_app() {
	local name="$1"
	if ! command -v spicetify >/dev/null 2>&1; then
		printf '%s' ""
		return 0
	fi
	local p
	p="$(spicetify_path_line path -a "${name}")"
	if [[ -n "${p}" && -d "${p}" ]]; then
		printf '%s' "${p}"
		return 0
	fi
	printf '%s' ""
}

remove_app_dir_safe() {
	local target="$1" label="$2"
	[[ -n "${target}" ]] || return 0
	[[ -e "${target}" ]] || return 0
	if rm -rf -- "${target}"; then
		detail "removed ${label}: ${target}"
	else
		warn "could not remove ${label} at ${target}"
		warn "If Spotify is running, close it and re-run the installer."
		exit 1
	fi
}

# Defensive: spicetify's GetCustomAppSubfolderPath recursively walks the install dir and
# returns the FIRST subfolder containing index.js, which would hijack the loader. After a
# fresh install, manifest.json + index.js live at the top level only, but a botched user
# state might leave a nested copy. Detect and remove them.
clean_nested_app_layout() {
	local app_dir="$1"
	[[ -d "${app_dir}" ]] || return 0
	local subdir
	while IFS= read -r -d '' subdir; do
		# Skip the top-level dir itself; only nested.
		if [[ "${subdir}" != "${app_dir}" && -f "${subdir}/index.js" ]]; then
			warn "stale nested index.js detected at ${subdir} - removing"
			rm -rf -- "${subdir}"
		fi
	done < <(find "${app_dir}" -mindepth 1 -type d -print0 2>/dev/null)
}

# Install Spicetify CLI to ~/.spicetify when missing (same release tarball as spicetify/cli; no Marketplace prompt;
# no install.log in CWD). Current shell gets PATH; optional bash/zsh rc append.
ensure_spicetify_cli() {
	if [[ "${LISTENING_STATS_SKIP_SPICETIFY_INSTALL:-}" == "1" ]]; then
		command -v spicetify >/dev/null 2>&1 || die "spicetify not found and LISTENING_STATS_SKIP_SPICETIFY_INSTALL=1."
		return 0
	fi

	if command -v spicetify >/dev/null 2>&1; then
		return 0
	fi

	local install_dir="${HOME}/.spicetify"
	local exe="${install_dir}/spicetify"
	if [[ -x "${exe}" ]]; then
		export PATH="${install_dir}:${PATH}"
		command -v spicetify >/dev/null 2>&1 && return 0
	fi

	if [[ "$(id -u)" -eq 0 ]]; then
		die "Do not run this script as root/sudo. Install as your normal user (Spicetify requirement), then re-run."
	fi

	local dep
	for dep in curl tar grep; do
		command -v "${dep}" >/dev/null 2>&1 || die "${dep} is required to install Spicetify CLI automatically."
	done

	local target=""
	case "$(uname -sm)" in
		"Darwin x86_64") target="darwin-amd64" ;;
		"Darwin arm64") target="darwin-arm64" ;;
		"Linux x86_64") target="linux-amd64" ;;
		"Linux aarch64") target="linux-arm64" ;;
		*) die "Automatic Spicetify install supports macOS/Linux x86_64 and arm64 only. Install Spicetify manually: https://spicetify.app/docs/advanced/installation" ;;
	esac

	step "Installing Spicetify CLI (first-time, non-interactive)"
	local releases_uri="https://github.com/spicetify/cli/releases"
	local json tag ver download_uri tgz
	json="$(curl -LsH "Accept: application/json" "${releases_uri}/latest")" || die "Could not reach GitHub for Spicetify releases."
	tag="${json%%\",\"update_url*}"
	tag="${tag##*tag_name\":\"}"
	tag="${tag%\"}"
	ver="${tag#v}"
	download_uri="${releases_uri}/download/v${ver}/spicetify-${ver}-${target}.tar.gz"

	mkdir -p "${install_dir}"
	tgz="$(mktemp)"
	if ! curl -fsSL --progress-bar "${download_uri}" -o "${tgz}"; then
		rm -f "${tgz}"
		die "Failed to download Spicetify CLI."
	fi
	if ! tar xzf "${tgz}" -C "${install_dir}"; then
		rm -f "${tgz}"
		die "Failed to extract Spicetify CLI."
	fi
	rm -f "${tgz}"
	chmod +x "${exe}"
	export PATH="${install_dir}:${PATH}"

	command -v spicetify >/dev/null 2>&1 || die "Spicetify extracted but not executable. Check ${install_dir}."

	# Persist PATH for bash/zsh (best-effort; current shell already has export)
	case "${SHELL:-}" in
		*zsh*)
			local rc="${HOME}/.zshrc"
			if [[ -n "${ZDOTDIR:-}" ]]; then
				rc="${ZDOTDIR}/.zshrc"
			fi
			[[ -f "${rc}" ]] || touch "${rc}"
			if ! grep -Fq "${install_dir}" "${rc}" 2>/dev/null; then
				{
					echo ""
					echo "# Spicetify CLI (added by Listening Stats installer)"
					echo "export PATH=\"${install_dir}:\$PATH\""
				} >>"${rc}"
			fi
			;;
		*bash*)
			local rc
			for rc in "${HOME}/.bashrc" "${HOME}/.bash_profile"; do
				[[ -f "${rc}" ]] || continue
				if ! grep -Fq "${install_dir}" "${rc}" 2>/dev/null; then
					{
						echo ""
						echo "# Spicetify CLI (added by Listening Stats installer)"
						echo "export PATH=\"${install_dir}:\$PATH\""
					} >>"${rc}"
				fi
			done
			;;
	esac

	detail "Spicetify v${ver}  -  ${exe}"
}

apply_with_recovery() {
	step "Applying Spicetify (${DIM}config + apply${RST})"
	spicetify_run config custom_apps "${APP_NAME}"
	if [[ "${SPC_RC}" -ne 0 ]]; then
		[[ -n "${SPC_OUT}" ]] && warn "${SPC_OUT}"
		die "spicetify config failed (exit ${SPC_RC})."
	fi

	spicetify_run apply
	local needs_rebackup=0
	if [[ "${SPC_RC}" -ne 0 ]]; then needs_rebackup=1; fi
	if printf '%s' "${SPC_OUT}" | grep -Eiq 'outdated|mismatch|backup apply|restore backup apply'; then
		needs_rebackup=1
	fi

	if [[ "${needs_rebackup}" -eq 0 ]]; then
		return 0
	fi

	warn "spicetify apply reported a stale-backup or version-mismatch state:"
	[[ -n "${SPC_OUT}" ]] && printf '%s\n' "${SPC_OUT}" | sed 's/^/   /' >&2

	step "Auto-recovery: spicetify backup apply"
	spicetify_run backup apply
	if [[ "${SPC_RC}" -eq 0 ]]; then
		return 0
	fi
	[[ -n "${SPC_OUT}" ]] && printf '%s\n' "${SPC_OUT}" | sed 's/^/   /' >&2

	warn "backup apply failed; trying restore + backup + apply"
	spicetify_run restore backup apply
	if [[ "${SPC_RC}" -eq 0 ]]; then
		return 0
	fi
	[[ -n "${SPC_OUT}" ]] && printf '%s\n' "${SPC_OUT}" | sed 's/^/   /' >&2
	die "Could not auto-recover spicetify state. Close Spotify completely and run: spicetify restore backup apply"
}

banner

ensure_spicetify_cli

ZIP_URL="$(resolve_zip_url "${REPO_SLUG}")"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
ZIP_PATH="${TMP_DIR}/${APP_NAME}.zip"
EXTRACT="${TMP_DIR}/extract"

step "Locating Spicetify CustomApps"
USER_CUSTOM_APPS="$(resolve_user_config_custom_apps)"
EXE_CUSTOM_APPS="$(resolve_exe_dir_custom_apps)"
detail "user-config (install target) : ${USER_CUSTOM_APPS}"
if [[ -n "${EXE_CUSTOM_APPS}" && "${EXE_CUSTOM_APPS}" != "${USER_CUSTOM_APPS}" ]]; then
	detail "exe-dir (cleanup only)        : ${EXE_CUSTOM_APPS}"
fi

DEST="${USER_CUSTOM_APPS}/${APP_NAME}"

# Cleanup pass: remove every place a stale listening-stats could live so the loader can't pick
# up an old copy. spicetify resolves at apply time via GetCustomAppPath: user-config first,
# then exe-dir. We wipe both, plus whatever the CLI currently *thinks* the path is.
step "Removing any prior ${APP_NAME} copies"
RESOLVED="$(resolve_spicetify_resolved_app "${APP_NAME}")"
declare -a CLEANUP_TARGETS=()
CLEANUP_TARGETS+=("${DEST}")
[[ -n "${EXE_CUSTOM_APPS}" ]] && CLEANUP_TARGETS+=("${EXE_CUSTOM_APPS}/${APP_NAME}")
[[ -n "${RESOLVED}" ]] && CLEANUP_TARGETS+=("${RESOLVED}")

# Dedupe (preserve order).
declare -a SEEN=()
for t in "${CLEANUP_TARGETS[@]}"; do
	dup=0
	for s in "${SEEN[@]:-}"; do
		[[ "${s}" == "${t}" ]] && dup=1 && break
	done
	[[ "${dup}" -eq 0 ]] || continue
	SEEN+=("${t}")
	remove_app_dir_safe "${t}" "${APP_NAME}"
done

step "Downloading ${DIM}${ZIP_URL}${RST}"
if command -v curl >/dev/null 2>&1; then
	if ! curl -fSL --progress-bar "${ZIP_URL}" -o "${ZIP_PATH}"; then
		die "Download failed (${ZIP_URL}). Check https://github.com/${REPO_SLUG}/releases for a release that includes listening-stats.zip, then re-run the installer."
	fi
else
	die "curl not found. Install curl or download the zip manually from GitHub."
fi

SIZE="$(wc -c <"${ZIP_PATH}" | tr -d ' ')"
if (( SIZE < MIN_ZIP_BYTES )); then
	die "Download is too small (${SIZE} bytes)  -  expected a real release zip. Is ${ZIP_URL} valid?"
fi

mkdir -p "${EXTRACT}"

step "Extracting bundle"
if ! unzip -q "${ZIP_PATH}" -d "${EXTRACT}"; then
	die "unzip failed. Is unzip installed?"
fi

step "Installing"
detail "→ ${DEST}"
mkdir -p "${USER_CUSTOM_APPS}"

# Always install into <user-config>/CustomApps/listening-stats  -  never unpack loose files.
if [[ -d "${EXTRACT}/${APP_NAME}" ]]; then
	mv "${EXTRACT}/${APP_NAME}" "${DEST}"
elif [[ -f "${EXTRACT}/manifest.json" || -f "${EXTRACT}/index.js" ]]; then
	mkdir -p "${DEST}"
	shopt -s dotglob nullglob
	for item in "${EXTRACT}"/*; do
		[[ -e "${item}" ]] || continue
		mv "${item}" "${DEST}/"
	done
	shopt -u dotglob nullglob
else
	dir_count=0
	sole_dir=""
	for maybe in "${EXTRACT}"/*; do
		[[ -d "${maybe}" ]] || continue
		dir_count=$((dir_count + 1))
		sole_dir="${maybe}"
	done
	if [[ "${dir_count}" -eq 1 && ( -f "${sole_dir}/manifest.json" || -f "${sole_dir}/index.js" ) ]]; then
		mv "${sole_dir}" "${DEST}"
	else
		die "Zip layout not recognized. Expected ${APP_NAME}/ in the zip, app files at zip root, or one top-level app folder."
	fi
fi

if [[ ! -f "${DEST}/manifest.json" ]]; then
	die "Installed folder is missing manifest.json  -  zip may be wrong or corrupt."
fi

clean_nested_app_layout "${DEST}"

apply_with_recovery

echo ""
rule
echo "${GRN}${BOLD}Done.${RST}  Restart Spotify if the app does not pick up changes."
rule
echo ""
