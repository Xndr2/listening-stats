#!/usr/bin/env bash
# Listening Stats  -  install or update for Spicetify (macOS / Linux).
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.sh | bash
# Prerelease zip (newest GitHub release that includes listening-stats.zip):
#   LISTENING_STATS_PRERELEASE=1 curl -fsSL … | bash
#
# If Spicetify CLI is missing, installs it to ~/.spicetify (non-interactive; no Marketplace).
# Set LISTENING_STATS_SKIP_SPICETIFY_INSTALL=1 to only install LS (fail if spicetify missing).
#
# Downloads listening-stats.zip from GitHub Releases (default: latest stable). With
# LISTENING_STATS_PRERELEASE=1, uses the newest release that ships listening-stats.zip (may be a prerelease).
# Requires jq or python3 for the prerelease path.
#
# Replaces CustomApps/listening-stats, runs spicetify apply, removes temp files.

set -euo pipefail

REPO_SLUG="Xndr2/listening-stats"
MIN_ZIP_BYTES=2000

resolve_zip_url() {
	local slug="$1"
	if [[ "${LISTENING_STATS_PRERELEASE:-}" == "1" ]]; then
		local api_url="https://api.github.com/repos/${slug}/releases?per_page=20"
		local json tag
		json="$(curl -sSf -H "Accept: application/vnd.github+json" "${api_url}")" || {
			echo "! Could not reach GitHub API (prerelease lookup)." >&2
			exit 1
		}
		if command -v jq >/dev/null 2>&1; then
			tag="$(printf '%s' "${json}" | jq -r '.[] | select((.assets // []) | map(.name) | index("listening-stats.zip")) | .tag_name' | head -n1)"
		elif command -v python3 >/dev/null 2>&1; then
			tag="$(printf '%s' "${json}" | python3 -c '
import json, sys
data = json.load(sys.stdin)
for r in data:
    names = [a.get("name") for a in r.get("assets") or []]
    if "listening-stats.zip" in names:
        print(r["tag_name"])
        break
')"
		else
			echo "! LISTENING_STATS_PRERELEASE=1 requires jq or python3." >&2
			exit 1
		fi
		[[ -n "${tag}" ]] || {
			echo "! No GitHub release includes listening-stats.zip." >&2
			exit 1
		}
		printf '%s\n' "https://github.com/${slug}/releases/download/${tag}/listening-stats.zip"
	else
		printf '%s\n' "https://github.com/${slug}/releases/latest/download/listening-stats.zip"
	fi
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

die() {
	echo "${YEL}${BOLD}!${RST} $1" >&2
	exit 1
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

	echo "   ${DIM}Spicetify v${ver}  -  ${exe}${RST}"
}

ZIP_URL="$(resolve_zip_url "${REPO_SLUG}")"

banner

ensure_spicetify_cli

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

ZIP_PATH="${TMP_DIR}/listening-stats.zip"

step "Downloading ${DIM}${ZIP_URL}${RST}"
if command -v curl >/dev/null 2>&1; then
	curl -fSL --progress-bar "${ZIP_URL}" -o "${ZIP_PATH}"
else
	die "curl not found. Install curl or download the zip manually from GitHub."
fi

SIZE="$(wc -c <"${ZIP_PATH}" | tr -d ' ')"
if (( SIZE < MIN_ZIP_BYTES )); then
	die "Download is too small (${SIZE} bytes)  -  expected a real release zip. Is ${ZIP_URL} valid?"
fi

step "Locating Spicetify CustomApps directory"
CUSTOM_APPS=""
if command -v spicetify >/dev/null 2>&1; then
	# Prefer CLI custom-app root (matches where apply looks)
	CUSTOM_APPS="$(spicetify -q -a path root 2>/dev/null || spicetify -a path root 2>/dev/null || true)"
	CUSTOM_APPS="$(printf '%s' "${CUSTOM_APPS}" | head -1 | tr -d '\r')"
	if [[ -z "${CUSTOM_APPS}" || ! -d "${CUSTOM_APPS}" ]]; then
		USERDATA="$(spicetify -q path userdata 2>/dev/null || spicetify path userdata 2>/dev/null)"
		USERDATA="$(printf '%s' "${USERDATA}" | tr -d '\r')"
		if [[ -n "${USERDATA}" && -d "${USERDATA}" ]]; then
			CUSTOM_APPS="${USERDATA}/CustomApps"
		fi
	fi
fi
if [[ -z "${CUSTOM_APPS}" ]]; then
	if [[ "$(uname -s)" == "Darwin" ]]; then
		for cand in "${HOME}/spicetify_data/CustomApps" "${HOME}/.config/spicetify/CustomApps"; do
			if [[ -d "${cand}" ]]; then
				CUSTOM_APPS="${cand}"
				break
			fi
		done
		[[ -n "${CUSTOM_APPS}" ]] || CUSTOM_APPS="${HOME}/spicetify_data/CustomApps"
	else
		CUSTOM_APPS="${HOME}/.config/spicetify/CustomApps"
	fi
fi

TARGET="${CUSTOM_APPS}/listening-stats"
echo "   ${DIM}→ ${TARGET}${RST}"

EXTRACT="${TMP_DIR}/extract"
rm -rf "${EXTRACT}"
mkdir -p "${EXTRACT}"

step "Extracting bundle"
if ! unzip -q "${ZIP_PATH}" -d "${EXTRACT}"; then
	die "unzip failed. Is unzip installed?"
fi

# Always install into CustomApps/listening-stats  -  never unpack loose files into CustomApps.
mkdir -p "${CUSTOM_APPS}"
rm -rf "${TARGET}"
if [[ -d "${EXTRACT}/listening-stats" ]]; then
	mv "${EXTRACT}/listening-stats" "${TARGET}"
elif [[ -f "${EXTRACT}/manifest.json" || -f "${EXTRACT}/index.js" ]]; then
	mkdir -p "${TARGET}"
	shopt -s dotglob nullglob
	for item in "${EXTRACT}"/*; do
		[[ -e "${item}" ]] || continue
		mv "${item}" "${TARGET}/"
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
		mv "${sole_dir}" "${TARGET}"
	else
		die "Zip layout not recognized. Expected listening-stats/ in the zip, app files at zip root, or one top-level app folder."
	fi
fi

if [[ ! -f "${TARGET}/manifest.json" ]]; then
	die "Installed folder is missing manifest.json  -  zip may be wrong or corrupt."
fi

step "Applying Spicetify (${DIM}config + apply${RST})"
spicetify config custom_apps listening-stats
spicetify apply

echo ""
rule
echo "${GRN}${BOLD}Done.${RST}  Restart Spotify if the app does not pick up changes."
rule
echo ""
