"""
osm_roads.py  --  Fetch major road names + geometry from OpenStreetMap Overpass API.

Usage as a library:
    from osm_roads import fetch_and_parse_roads

    roads = fetch_and_parse_roads(
        south=41.575, west=-109.24, north=41.63, east=-109.18,
        max_roads=20,
    )
    for r in roads:
        print(r["name"], r["center_lat"], r["center_lon"], r["bearing"])

Usage from the command line (for quick testing):
    python osm_roads.py --bbox 41.575,-109.24,41.63,-109.18 --max 20

Only uses stdlib (urllib, json, math) -- no external packages required.
"""

import json
import math
import urllib.parse
import urllib.request
import time
import sys

# ─── Configuration ───────────────────────────────────────────────────────────

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Highway types ordered from most to least important.
# For a small city map, this covers interstates down to collector streets.
#
#   motorway        Interstate / freeway (I-80, I-25)
#   motorway_link   On/off ramps for motorways
#   trunk           US highways, expressways (US 191, US 30)
#   trunk_link      Ramps / slip roads for trunk
#   primary         State highways, major urban arterials (WY 430, Dewar Dr)
#   primary_link    Ramps / slip roads for primary
#   secondary       County roads, minor arterials (College Dr, Blair Ave)
#   secondary_link  Ramps / slip roads for secondary
#   tertiary        Collector streets in town grids (Broadway, 2nd St)
#
# Include residential and unclassified so every visible white road gets a label.
HIGHWAY_TYPES = [
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "residential",
    "unclassified",
]

# Rank lookup (lower = more important)
_HW_RANK = {t: i for i, t in enumerate(HIGHWAY_TYPES)}


# ─── Overpass query ──────────────────────────────────────────────────────────

def _build_query(south, west, north, east, timeout=60):
    """
    Build an Overpass QL query that fetches named ways of the configured
    highway types inside the given bounding box.

    Returns full geometry with `out geom;` so each element includes a
    `geometry` array of {lat, lon} points -- no need for a second `>;out skel;`
    round-trip.
    """
    hw_regex = "|".join(HIGHWAY_TYPES)
    return (
        f'[out:json][timeout:{timeout}];'
        f'way["highway"~"^({hw_regex})$"]["name"]'
        f'({south},{west},{north},{east});'
        f'out geom;'
    )


def fetch_overpass(south, west, north, east, timeout=60, retries=3):
    """
    POST to the Overpass API and return the parsed JSON response.

    Parameters
    ----------
    south, west, north, east : float
        Bounding box in decimal degrees (WGS84).
        Order: south-lat, west-lon, north-lat, east-lon.
    timeout : int
        Server-side query timeout in seconds (also used for urllib timeout).
    retries : int
        Number of attempts before giving up (with 5-second back-off).

    Returns
    -------
    dict
        The raw Overpass JSON response.  Key field is "elements", a list of
        way objects each containing "tags" and "geometry".
    """
    query = _build_query(south, west, north, east, timeout)
    post_data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(OVERPASS_URL, data=post_data)
    req.add_header("User-Agent", "Python/osm_roads")

    last_err = None
    for attempt in range(retries):
        try:
            resp = urllib.request.urlopen(req, timeout=timeout + 10)
            return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            last_err = exc
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
    raise RuntimeError(
        f"Overpass API failed after {retries} attempts: {last_err}"
    )


# ─── Geometry helpers ────────────────────────────────────────────────────────

def _bearing(lat1, lon1, lat2, lon2):
    """
    Initial bearing (forward azimuth) from point 1 to point 2.

    Returns degrees in [0, 360).
    0 = north, 90 = east, 180 = south, 270 = west.
    """
    lat1, lon1, lat2, lon2 = (math.radians(v) for v in (lat1, lon1, lat2, lon2))
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = (math.cos(lat1) * math.sin(lat2)
         - math.sin(lat1) * math.cos(lat2) * math.cos(dlon))
    return math.degrees(math.atan2(x, y)) % 360


def normalize_bearing_for_text(bearing):
    """
    Normalize a bearing so that text drawn along it reads left-to-right.

    If the bearing points generally rightward (315..360 or 0..135), keep it.
    Otherwise flip by 180 degrees so text isn't upside-down.

    Returns degrees in [0, 360).
    """
    b = bearing % 360
    if 135 < b <= 315:
        b = (b + 180) % 360
    return b


# ─── Parse + deduplicate ────────────────────────────────────────────────────

def parse_roads(overpass_json, bbox=None):
    """
    Parse the raw Overpass response into deduplicated road records.

    Multiple OSM way segments with the same name are merged.  The center
    point and bearing are computed from the longest segment (which tends to
    be the most visually prominent piece of the road).

    Parameters
    ----------
    overpass_json : dict
        Raw JSON from ``fetch_overpass``.
    bbox : tuple of (south, west, north, east) or None
        If given, clamp center points inside the bbox (useful when a road's
        longest segment extends outside the query area).

    Returns
    -------
    list of dict
        Each dict has:
            name        : str   -- road name
            highway     : str   -- highest-rank highway tag for this name
            center_lat  : float -- latitude of the label anchor point
            center_lon  : float -- longitude of the label anchor point
            bearing     : float -- compass bearing in degrees [0,360)
            text_bearing: float -- bearing normalized for left-to-right text
            total_nodes : int   -- total geometry nodes (proxy for road length)
            geometry    : list  -- full [{lat,lon}, ...] of the longest segment
    """
    # Group all way segments by road name
    by_name = {}
    for elem in overpass_json.get("elements", []):
        tags = elem.get("tags", {})
        name = tags.get("name")
        hw = tags.get("highway", "")
        geom = elem.get("geometry", [])
        if not name or len(geom) < 2:
            continue

        if name not in by_name:
            by_name[name] = {"segments": [], "best_hw": hw}

        by_name[name]["segments"].append(geom)

        # Keep track of the highest-ranking highway type for this road
        cur_rank = _HW_RANK.get(by_name[name]["best_hw"], 99)
        new_rank = _HW_RANK.get(hw, 99)
        if new_rank < cur_rank:
            by_name[name]["best_hw"] = hw

    results = []
    for name, info in by_name.items():
        # Use the longest segment for the label placement
        longest = max(info["segments"], key=len)

        # Center = midpoint node of the longest segment
        mid = len(longest) // 2
        clat = longest[mid]["lat"]
        clon = longest[mid]["lon"]

        # Optionally clamp inside the bbox
        if bbox:
            s, w, n, e = bbox
            clat = max(s, min(n, clat))
            clon = max(w, min(e, clon))

        # Bearing at the center (use one node before and one node after mid)
        i0 = max(0, mid - 1)
        i1 = min(len(longest) - 1, mid + 1)
        brg = _bearing(
            longest[i0]["lat"], longest[i0]["lon"],
            longest[i1]["lat"], longest[i1]["lon"],
        )

        total_nodes = sum(len(seg) for seg in info["segments"])

        results.append({
            "name": name,
            "highway": info["best_hw"],
            "center_lat": clat,
            "center_lon": clon,
            "bearing": round(brg, 2),
            "text_bearing": round(normalize_bearing_for_text(brg), 2),
            "total_nodes": total_nodes,
            "geometry": longest,
        })

    # Sort: most important highway type first, then longest roads first
    results.sort(key=lambda r: (_HW_RANK.get(r["highway"], 99), -r["total_nodes"]))
    return results


# ─── High-level convenience function ────────────────────────────────────────

def fetch_all_segments(south, west, north, east, timeout=60, retries=3):
    """
    Fetch every road segment from Overpass without deduplication.

    Unlike ``fetch_and_parse_roads`` which keeps only the longest segment per
    road name, this returns every individual way so that ``draw_white_roads``
    can render full-coverage road lines on the map.

    Uses a union query to capture both named roads (for white-line drawing and
    labels) *and* roads with ``ref`` tags (for highway shield rendering) in a
    single API call, avoiding rate-limiting issues from multiple requests.

    Returns
    -------
    list of dict
        Each dict has: name, highway, ref, geometry (list of {lat, lon}).
    """
    # Build a union query: named roads + ref-tagged major roads (for shields)
    hw_regex = "|".join(HIGHWAY_TYPES)
    ref_hw = "motorway|motorway_link|trunk|trunk_link|primary|primary_link"
    query = (
        f'[out:json][timeout:{timeout}];'
        f'('
        f'way["highway"~"^({hw_regex})$"]["name"]'
        f'({south},{west},{north},{east});'
        f'way["highway"~"^({ref_hw})$"]["ref"]'
        f'({south},{west},{north},{east});'
        f');'
        f'out geom;'
    )
    post_data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(OVERPASS_URL, data=post_data)
    req.add_header("User-Agent", "Python/osm_roads")

    last_err = None
    for attempt in range(retries):
        try:
            resp = urllib.request.urlopen(req, timeout=timeout + 10)
            raw = json.loads(resp.read().decode("utf-8"))
            break
        except Exception as exc:
            last_err = exc
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
    else:
        raise RuntimeError(
            f"Overpass API failed after {retries} attempts: {last_err}"
        )
    segments = []
    seen_ids = set()
    for elem in raw.get("elements", []):
        # Deduplicate by OSM way ID (union query may return same way twice)
        way_id = elem.get("id")
        if way_id in seen_ids:
            continue
        seen_ids.add(way_id)

        tags = elem.get("tags", {})
        geom = elem.get("geometry", [])
        if len(geom) < 2:
            continue
        segments.append({
            "name": tags.get("name", ""),
            "highway": tags.get("highway", ""),
            "ref": tags.get("ref", ""),
            "geometry": geom,
        })
    return segments


def fetch_highway_refs(south, west, north, east, timeout=60, retries=3):
    """
    Fetch major highways with ``ref`` tags for shield rendering.

    Queries motorway/trunk/primary ways that have a ``ref`` tag (e.g. "I 90",
    "US 87", "MT 3").  Returns deduplicated records with a representative
    center point for shield placement.

    Returns
    -------
    list of dict
        Each dict has: ref, highway, center_lat, center_lon.
    """
    hw_types = "motorway|trunk|primary"
    query = (
        f'[out:json][timeout:{timeout}];'
        f'way["highway"~"^({hw_types})$"]["ref"]'
        f'({south},{west},{north},{east});'
        f'out geom;'
    )
    post_data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(OVERPASS_URL, data=post_data)
    req.add_header("User-Agent", "Python/osm_roads")

    last_err = None
    for attempt in range(retries):
        try:
            resp = urllib.request.urlopen(req, timeout=timeout + 10)
            raw = json.loads(resp.read().decode("utf-8"))
            break
        except Exception as exc:
            last_err = exc
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
    else:
        print(f"  WARNING: Overpass highway ref query failed: {last_err}")
        return []

    # Deduplicate by ref string — keep the longest segment for placement
    by_ref = {}
    for elem in raw.get("elements", []):
        tags = elem.get("tags", {})
        ref = tags.get("ref", "").strip()
        hw = tags.get("highway", "")
        geom = elem.get("geometry", [])
        if not ref or len(geom) < 2:
            continue
        if ref not in by_ref or len(geom) > len(by_ref[ref]["geometry"]):
            mid = len(geom) // 2
            by_ref[ref] = {
                "ref": ref,
                "highway": hw,
                "center_lat": geom[mid]["lat"],
                "center_lon": geom[mid]["lon"],
                "geometry": geom,
            }

    results = list(by_ref.values())
    # Drop the large geometry from the result — only need center point
    for r in results:
        del r["geometry"]
    return results


def fetch_and_parse_roads(south, west, north, east,
                          max_roads=20, timeout=60, retries=3):
    """
    One-call convenience: fetch from Overpass + parse + truncate.

    Parameters
    ----------
    south, west, north, east : float
        Bounding box (decimal degrees).
    max_roads : int or None
        Limit the returned list to the N most important roads.
        Set to None for all roads.
    timeout : int
        Overpass server timeout in seconds.
    retries : int
        Number of retry attempts on failure.

    Returns
    -------
    list of dict
        See ``parse_roads`` for the dict schema.

    Example
    -------
    >>> roads = fetch_and_parse_roads(41.575, -109.24, 41.63, -109.18)
    >>> roads[0]["name"]
    'Dwight D. Eisenhower Highway'
    """
    raw = fetch_overpass(south, west, north, east, timeout=timeout, retries=retries)
    bbox = (south, west, north, east)
    roads = parse_roads(raw, bbox=bbox)

    if max_roads is not None:
        roads = roads[:max_roads]

    return roads


# ─── CLI entry point ─────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Fetch major road names from OpenStreetMap for a bounding box."
    )
    parser.add_argument(
        "--bbox", required=True,
        help="south,west,north,east in decimal degrees (e.g. 41.575,-109.24,41.63,-109.18)",
    )
    parser.add_argument("--max", type=int, default=20, help="Max roads to return (default 20)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    parts = [float(x) for x in args.bbox.split(",")]
    if len(parts) != 4:
        print("ERROR: --bbox must have exactly 4 comma-separated values", file=sys.stderr)
        sys.exit(1)
    south, west, north, east = parts

    roads = fetch_and_parse_roads(south, west, north, east, max_roads=args.max)

    if args.json:
        # Strip geometry from JSON output (too verbose)
        clean = [{k: v for k, v in r.items() if k != "geometry"} for r in roads]
        print(json.dumps(clean, indent=2))
    else:
        print(f"{'#':>3}  {'Highway':15}  {'Name':30}  {'Center Lat':>11}  {'Center Lon':>11}  {'Bearing':>7}  {'TextBrg':>7}  {'Nodes':>5}")
        print("-" * 110)
        for i, r in enumerate(roads, 1):
            print(
                f"{i:3d}  {r['highway']:15}  {r['name']:30}  "
                f"{r['center_lat']:11.5f}  {r['center_lon']:11.5f}  "
                f"{r['bearing']:7.1f}  {r['text_bearing']:7.1f}  "
                f"{r['total_nodes']:5d}"
            )


if __name__ == "__main__":
    main()
