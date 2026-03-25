#!/usr/bin/env python3
"""
generate_map.py — Generate a numbered-pin map image from processed listings.

Usage:
    python generate_map.py --data ./data/processed_listings.json --output ./output/map.png

Uses Google Maps Static API for satellite base map + Pillow for circular numbered pins.
Requires GOOGLE_MAPS_API_KEY environment variable.

Fallback: OpenStreetMap Nominatim + Pillow rendering (no API key needed).
"""

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install Pillow")
    sys.exit(1)


DEFAULT_RENDER_CONFIG = {
    "renderMode": "mapbox-osm-overlay",
    "providers": {
        "mapbox": {
            "styleId": "",
            "fallbackStyleId": "mapbox/satellite-v9",
        }
    },
    "framing": {
        "paddingFactor": 1.24,
        "zoomOutSteps": 1,
        "minZoom": 10,
        "maxZoom": 18,
        "centerOffsetXPct": 0.0,
        "centerOffsetYPct": 0.04,
        "boundsMarginDeg": 0.012,
    },
    "pins": {
        "radius": 13,
        "fontSize": 15,
        "minSeparationPx": 34,
    },
    "output": {
        "width": 1200,
        "height": 800,
        "cropBottomPx": 50,
    },
    "geocoding": {
        "cacheFile": "./data/geocode_cache.json",
        "enableCache": True,
        "primary": "google",
        "fallbacks": ["nominatim", "census"],
    },
}


def _deep_merge(base: dict, override: dict) -> dict:
    merged = dict(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def get_skill_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_render_config(config_path: str | None = None) -> dict:
    path = Path(config_path) if config_path else get_skill_root() / "config" / "map-renderer.json"
    config = DEFAULT_RENDER_CONFIG
    if path.exists():
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            config = _deep_merge(DEFAULT_RENDER_CONFIG, loaded)
        except Exception as exc:
            print(f"WARNING: Failed to load render config {path}: {exc}")
            config = DEFAULT_RENDER_CONFIG

    env_mode = os.environ.get("MAP_RENDER_MODE", "").strip()
    env_style = os.environ.get("MAPBOX_STYLE", "").strip()
    if env_mode:
        config["renderMode"] = env_mode
    configured_style = config.get("providers", {}).get("mapbox", {}).get("styleId", "").strip()
    if env_style and not configured_style:
        config.setdefault("providers", {}).setdefault("mapbox", {})["styleId"] = env_style
    return config


def resolve_data_path(path_str: str) -> Path:
    path = Path(path_str)
    if path.is_absolute():
        return path
    return (get_skill_root() / path).resolve()


def load_geocode_cache(config: dict) -> dict:
    geocoding = config.get("geocoding", {})
    if not geocoding.get("enableCache", True):
        return {}
    cache_path = resolve_data_path(geocoding.get("cacheFile", "./data/geocode_cache.json"))
    if not cache_path.exists():
        return {}
    try:
        return json.loads(cache_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"WARNING: Failed to read geocode cache {cache_path}: {exc}")
        return {}


def save_geocode_cache(config: dict, cache: dict) -> None:
    geocoding = config.get("geocoding", {})
    if not geocoding.get("enableCache", True):
        return
    cache_path = resolve_data_path(geocoding.get("cacheFile", "./data/geocode_cache.json"))
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache, indent=2, sort_keys=True), encoding="utf-8")


def normalize_cache_key(address: str) -> str:
    return " ".join(str(address or "").strip().lower().split())


def prettify_road_label(name: str) -> str:
    """Expand common road abbreviations for cleaner presentation labels."""
    if not name:
        return ""
    text = f" {str(name).strip()} "
    replacements = {
        " Rd ": " Road ",
        " Ave ": " Avenue ",
        " Blvd ": " Boulevard ",
        " Dr ": " Drive ",
        " Ln ": " Lane ",
        " Hwy ": " Highway ",
        " Pkwy ": " Parkway ",
        " Frontage Rd ": " Frontage Road ",
        " N ": " North ",
        " S ": " South ",
        " E ": " East ",
        " W ": " West ",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def has_custom_mapbox_style(config: dict) -> bool:
    style = config.get("providers", {}).get("mapbox", {}).get("styleId", "").strip()
    return bool(style)


def get_map_render_mode(config: dict) -> str:
    requested = (config.get("renderMode") or "style-native-preferred").strip().lower()
    if requested == "style-native-preferred":
        return "mapbox-style-native" if has_custom_mapbox_style(config) else "mapbox-osm-overlay"
    return requested


def get_api_key() -> str | None:
    """Get Google Maps API key from environment."""
    key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    if not key:
        try:
            import subprocess
            result = subprocess.run(
                ["powershell", "-Command",
                 "[System.Environment]::GetEnvironmentVariable('GOOGLE_MAPS_API_KEY', 'User')"],
                capture_output=True, text=True, timeout=5
            )
            key = result.stdout.strip()
        except Exception:
            pass
    return key if key else None


def get_mapbox_token() -> str | None:
    """Get Mapbox access token from environment."""
    token = os.environ.get("MAPBOX_ACCESS_TOKEN", "")
    if not token:
        try:
            import subprocess
            result = subprocess.run(
                ["powershell", "-Command",
                 "[System.Environment]::GetEnvironmentVariable('MAPBOX_ACCESS_TOKEN', 'User')"],
                capture_output=True, text=True, timeout=5
            )
            token = result.stdout.strip()
        except Exception:
            pass
    return token if token else None


def get_mapbox_style(config: dict | None = None) -> str:
    """Return the configured Mapbox style for the active renderer."""
    config = config or load_render_config()
    providers = config.get("providers", {})
    mapbox = providers.get("mapbox", {})
    render_mode = get_map_render_mode(config)
    if render_mode == "mapbox-osm-overlay":
        return (mapbox.get("fallbackStyleId") or "mapbox/satellite-v9").strip()
    return (mapbox.get("styleId") or mapbox.get("fallbackStyleId") or "mapbox/satellite-v9").strip()


# --- Mapbox Static Images API ---

def fetch_mapbox_satellite_map(
    center_lat: float, center_lon: float, zoom: int,
    output_path: str, token: str,
    width: int = 1200, height: int = 800,
    config: dict | None = None,
) -> bool:
    """Fetch a satellite map with road labels from Mapbox Static Images API.

    Labels are rendered by Mapbox's engine — guaranteed alignment with roads.
    Use a custom Mapbox Studio style (MAPBOX_STYLE env var) for red labels
    and custom font sizes.
    """
    style = get_mapbox_style(config)

    # Mapbox Static Images: max 1280x1280 per dimension
    # With @2x → up to 2560x2560 effective pixels
    # For 1200x800: request 600x400 @2x = 1200x800
    api_w = min(width // 2, 1280)
    api_h = min(height // 2, 1280)

    cache_buster = int(time.time())
    url = (
        f"https://api.mapbox.com/styles/v1/{style}/static/"
        f"{center_lon},{center_lat},{zoom},0/"
        f"{api_w}x{api_h}@2x"
        f"?access_token={token}&cb={cache_buster}"
    )

    print(f"  Requesting Mapbox satellite map (zoom={zoom}, style={style})...")

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            img_data = resp.read()

        if len(img_data) < 1000:
            print(f"  WARNING: Mapbox response too small ({len(img_data)} bytes)")
            return False

        with open(output_path, "wb") as f:
            f.write(img_data)

        # Resize if dimensions don't match target
        img = Image.open(output_path)
        if img.size != (width, height):
            img = img.resize((width, height), Image.LANCZOS)
            img.save(output_path, "PNG", quality=95)

        print(f"  Mapbox satellite map saved: {output_path}")
        return True

    except Exception as e:
        print(f"  ERROR: Mapbox Static Images failed: {e}")
        return False


# --- Nominatim Geocoding ---

def nominatim_geocode(address: str) -> tuple[float, float] | None:
    """Geocode an address using OpenStreetMap Nominatim."""
    params = urllib.parse.urlencode({
        "q": address,
        "format": "json",
        "limit": 1,
    })
    url = f"https://nominatim.openstreetmap.org/search?{params}"

    req = urllib.request.Request(url, headers={
        "User-Agent": "MarketSurveyGenerator/1.0 (CRE tool)"
    })

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print(f"  Nominatim geocoding failed for '{address}': {e}")

    return None


# --- Google Maps Geocoding ---

def google_geocode(address: str, api_key: str) -> tuple[float, float] | None:
    """Geocode an address using Google Geocoding API."""
    params = urllib.parse.urlencode({
        "address": address,
        "key": api_key,
    })
    url = f"https://maps.googleapis.com/maps/api/geocode/json?{params}"

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return float(loc["lat"]), float(loc["lng"])
    except Exception:
        pass

    return None


# --- US Census Geocoder (fallback) ---

def census_geocode(address: str) -> tuple[float, float] | None:
    """Geocode using the free US Census Bureau geocoder (no API key needed)."""
    params = urllib.parse.urlencode({
        "address": address,
        "benchmark": "Public_AR_Current",
        "format": "json",
    })
    url = f"https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?{params}"

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            matches = data.get("result", {}).get("addressMatches", [])
            if matches:
                coords = matches[0].get("coordinates", {})
                lat = coords.get("y")
                lon = coords.get("x")
                if lat and lon:
                    print(f"    (Census geocoder matched)")
                    return float(lat), float(lon)
    except Exception as e:
        print(f"  Census geocoding failed for '{address}': {e}")

    return None


# --- Geocode all listings ---

def geocode_listings(listings: list[dict], api_key: str | None = None, config: dict | None = None) -> list[dict]:
    """Geocode all listings using cached results plus configured fallbacks.

    If a listing already has 'lat' and 'lon' fields, those are treated as manual
    overrides and returned directly. Successful lookups are cached to keep map
    generation deterministic across reruns.
    """
    config = config or load_render_config()
    cache = load_geocode_cache(config)
    cache_changed = False
    geocoding = config.get("geocoding", {})
    primary = geocoding.get("primary", "google")
    fallbacks = geocoding.get("fallbacks", ["nominatim", "census"])

    results = []
    for i, listing in enumerate(listings):
        address = listing.get("address", "")
        if isinstance(address, dict):
            address = address.get("value", "")

        manual_lat = listing.get("lat")
        manual_lon = listing.get("lon")
        if manual_lat is not None and manual_lon is not None:
            print(f"  Using manual coords for {i+1}/{len(listings)}: {address}")
            results.append({
                "map_num": i + 1,
                "address": address,
                "lat": float(manual_lat),
                "lon": float(manual_lon),
                "geocode_source": "manual",
                "manual_override": True,
            })
            continue

        cache_key = normalize_cache_key(address)
        cached = cache.get(cache_key)
        if cached and cached.get("lat") is not None and cached.get("lon") is not None:
            print(f"  Using cached coords for {i+1}/{len(listings)}: {address}")
            results.append({
                "map_num": i + 1,
                "address": address,
                "lat": float(cached["lat"]),
                "lon": float(cached["lon"]),
                "geocode_source": cached.get("source", "cache"),
                "manual_override": False,
            })
            continue

        print(f"  Geocoding {i+1}/{len(listings)}: {address}")
        coords = None
        source = None

        if primary == "google" and api_key:
            coords = google_geocode(address, api_key)
            if coords is not None:
                source = "google"

        for fallback in fallbacks:
            if coords is not None:
                break
            if fallback == "nominatim":
                coords = nominatim_geocode(address)
                if coords is not None:
                    source = "nominatim"
                time.sleep(1.1)
            elif fallback == "census":
                coords = census_geocode(address)
                if coords is not None:
                    source = "census"

        entry = {
            "map_num": i + 1,
            "address": address,
            "lat": coords[0] if coords else None,
            "lon": coords[1] if coords else None,
            "geocode_source": source,
            "manual_override": False,
        }
        results.append(entry)

        if coords is not None and cache_key:
            cache[cache_key] = {
                "lat": float(coords[0]),
                "lon": float(coords[1]),
                "source": source or "unknown",
            }
            cache_changed = True

    if cache_changed:
        save_geocode_cache(config, cache)

    return results


# --- Map math ---

def get_bounds(geocoded: list[dict], margin: float = 0.02) -> dict:
    """Calculate bounding box from geocoded points with margin."""
    lats = [g["lat"] for g in geocoded if g["lat"] is not None]
    lons = [g["lon"] for g in geocoded if g["lon"] is not None]

    if not lats or not lons:
        return {"min_lat": 0, "max_lat": 1, "min_lon": 0, "max_lon": 1}

    return {
        "min_lat": min(lats) - margin,
        "max_lat": max(lats) + margin,
        "min_lon": min(lons) - margin,
        "max_lon": max(lons) + margin,
    }


def compute_zoom(bounds: dict, img_width: int, img_height: int, config: dict | None = None) -> int:
    """Compute a fit zoom level using configurable framing rules."""
    config = config or load_render_config()
    framing = config.get("framing", {})
    padding_factor = float(framing.get("paddingFactor", 1.12))
    zoom_out_steps = int(framing.get("zoomOutSteps", 1))
    min_zoom = int(framing.get("minZoom", 10))
    max_zoom = int(framing.get("maxZoom", 18))

    lat_range = max(bounds["max_lat"] - bounds["min_lat"], 1e-6)
    lon_range = max(bounds["max_lon"] - bounds["min_lon"], 1e-6)
    padded_width = max(1.0, img_width / max(1.0, padding_factor))
    padded_height = max(1.0, img_height / max(1.0, padding_factor))

    zoom_lon = math.log2(padded_width * 360 / (256 * lon_range))

    center_lat = (bounds["min_lat"] + bounds["max_lat"]) / 2
    lat_rad = math.radians(center_lat)
    zoom_lat = math.log2(padded_height * 360 / (256 * lat_range * (1 / math.cos(lat_rad))))

    zoom = int(min(zoom_lon, zoom_lat)) - zoom_out_steps
    return max(min_zoom, min(zoom, max_zoom))


def resolve_map_camera(geocoded: list[dict], img_width: int, img_height: int, config: dict | None = None) -> tuple[float, float, int, dict]:
    """Resolve map center and zoom using configurable framing and optional offsets."""
    config = config or load_render_config()
    framing = config.get("framing", {})
    margin = float(framing.get("boundsMarginDeg", 0.01))
    bounds = get_bounds(geocoded, margin=margin)
    center_lat = (bounds["min_lat"] + bounds["max_lat"]) / 2
    center_lon = (bounds["min_lon"] + bounds["max_lon"]) / 2

    lat_range = bounds["max_lat"] - bounds["min_lat"]
    lon_range = bounds["max_lon"] - bounds["min_lon"]
    center_lat += lat_range * float(framing.get("centerOffsetYPct", 0.0))
    center_lon += lon_range * float(framing.get("centerOffsetXPct", 0.0))

    zoom = compute_zoom(bounds, img_width, img_height, config=config)
    return center_lat, center_lon, zoom, bounds


def lat_lon_to_pixel_google(lat: float, lon: float, center_lat: float, center_lon: float,
                             zoom: int, img_width: int, img_height: int) -> tuple[int, int]:
    """Convert lat/lon to pixel coordinates on a Google Static Map image.

    Uses the same Mercator projection as Google Maps.
    """
    scale = 2 ** zoom * 256 / (2 * math.pi)

    # World coordinates (Mercator)
    def to_world(la, lo):
        wx = scale * (math.radians(lo) + math.pi)
        sin_lat = math.sin(math.radians(la))
        # Clamp to avoid math domain error
        sin_lat = max(-0.9999, min(0.9999, sin_lat))
        wy = scale * (math.pi - math.log((1 + sin_lat) / (1 - sin_lat)) / 2)
        return wx, wy

    cx, cy = to_world(center_lat, center_lon)
    px, py = to_world(lat, lon)

    # Pixel position relative to image center
    x = int((px - cx) + img_width / 2)
    y = int((py - cy) + img_height / 2)

    return x, y


def compute_pin_layout_positions(
    geocoded: list[dict],
    center_lat: float,
    center_lon: float,
    zoom: int,
    img_width: int,
    img_height: int,
    config: dict | None = None,
) -> list[dict]:
    """Compute on-map pin positions with deterministic overlap nudging."""
    config = config or load_render_config()
    pin_cfg = config.get("pins", {})
    pin_radius = int(pin_cfg.get("radius", 13))
    min_separation = float(pin_cfg.get("minSeparationPx", (pin_radius * 2) + 8))
    margin = pin_radius + 4

    positions = []
    for idx, point in enumerate(geocoded):
        if point.get("lat") is None or point.get("lon") is None:
            continue
        x, y = lat_lon_to_pixel_google(
            point["lat"], point["lon"],
            center_lat, center_lon, zoom,
            img_width, img_height,
        )
        positions.append({
            "point": point,
            "x": float(x),
            "y": float(y),
            "base_x": float(x),
            "base_y": float(y),
            "order": idx,
        })

    if len(positions) < 2:
        return positions

    for _ in range(12):
        moved = False
        for i in range(len(positions)):
            for j in range(i + 1, len(positions)):
                a = positions[i]
                b = positions[j]
                dx = b["x"] - a["x"]
                dy = b["y"] - a["y"]
                dist = math.hypot(dx, dy)
                if dist >= min_separation:
                    continue
                if dist < 1e-3:
                    angle = ((a["order"] + b["order"] + 1) * 37) % 360
                    dx = math.cos(math.radians(angle))
                    dy = math.sin(math.radians(angle))
                    dist = 1.0
                push = (min_separation - dist) / 2.0
                ux = dx / dist
                uy = dy / dist
                a["x"] -= ux * push
                a["y"] -= uy * push
                b["x"] += ux * push
                b["y"] += uy * push
                moved = True

        for item in positions:
            item["x"] = min(max(item["x"], margin), img_width - margin)
            item["y"] = min(max(item["y"], margin), img_height - margin)

        if not moved:
            break

    return positions


# --- Google Static Map (satellite, no markers) ---

def fetch_google_satellite_map(
    center_lat: float, center_lon: float, zoom: int,
    output_path: str, api_key: str,
    width: int = 1200, height: int = 800,
) -> bool:
    """Fetch a Google satellite map image (no markers)."""
    # Google Static Maps: max 640x640 at scale=2 → 1280x1280
    api_w = min(width // 2, 640)
    api_h = min(height // 2, 640)

    params = {
        "center": f"{center_lat},{center_lon}",
        "zoom": str(zoom),
        "size": f"{api_w}x{api_h}",
        "scale": "2",
        "maptype": "hybrid",
        "key": api_key,
    }

    style_params = [
        # Suppress POIs and transit
        ("style", "feature:poi|visibility:off"),
        ("style", "feature:transit|visibility:off"),
        # White road geometry
        ("style", "feature:road|element:geometry.fill|color:0xffffff"),
        ("style", "feature:road|element:geometry.stroke|color:0xdddddd"),
        ("style", "feature:road.highway|element:geometry.fill|color:0xffffff"),
        ("style", "feature:road.highway|element:geometry.stroke|color:0xcccccc"),
        # Hide road labels — we render our own via OSM/Pillow for size control
        ("style", "feature:road|element:labels|visibility:off"),
        # Keep highway shields (interstate markers)
        ("style", "feature:road.highway|element:labels.icon|visibility:on"),
        # Hide large locality/neighborhood text blocks
        ("style", "feature:administrative.locality|element:labels|visibility:off"),
        ("style", "feature:administrative.neighborhood|element:labels|visibility:off"),
        ("style", "feature:administrative.land_parcel|element:labels|visibility:off"),
        # Hide water feature labels
        ("style", "feature:water|element:labels|visibility:off"),
    ]

    url = f"https://maps.googleapis.com/maps/api/staticmap?{urllib.parse.urlencode(params)}"
    for key, val in style_params:
        url += f"&{key}={urllib.parse.quote(val)}"
    print(f"  Requesting satellite map (zoom={zoom}, center={center_lat:.4f},{center_lon:.4f}, poi-suppressed)...")

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            img_data = resp.read()

            if len(img_data) < 1000:
                print(f"WARNING: Response too small ({len(img_data)} bytes). Check API key.")
                return False

            with open(output_path, "wb") as f:
                f.write(img_data)

            # Resize to target dimensions
            img = Image.open(output_path)
            if img.size != (width, height):
                img = img.resize((width, height), Image.LANCZOS)
                img.save(output_path, "PNG", quality=95)

            print(f"  Satellite base map saved: {output_path}")
            return True

    except Exception as e:
        print(f"ERROR: Google Static Maps request failed: {e}")
        return False


# --- Draw circular pins on map ---

def draw_circular_pins(img_path: str, geocoded: list[dict],
                       center_lat: float, center_lon: float, zoom: int,
                       img_width: int, img_height: int,
                       config: dict | None = None) -> None:
    """Draw standardized circular numbered pins on top of the map image."""
    valid = [g for g in geocoded if g["lat"] is not None]
    if not valid:
        return

    img = Image.open(img_path).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    config = config or load_render_config()
    pin_cfg = config.get("pins", {})
    font_size = int(pin_cfg.get("fontSize", 15))

    # Load font
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    pin_radius = int(pin_cfg.get("radius", 13))
    shadow_offset = 2
    positions = compute_pin_layout_positions(
        valid,
        center_lat,
        center_lon,
        zoom,
        img_width,
        img_height,
        config=config,
    )

    for pos in positions:
        point = pos["point"]
        x = int(round(pos["x"]))
        y = int(round(pos["y"]))

        # Skip pins outside image bounds
        if x < -pin_radius or x > img_width + pin_radius or y < -pin_radius or y > img_height + pin_radius:
            continue

        # Subtle drop shadow
        draw.ellipse(
            [x - pin_radius + shadow_offset, y - pin_radius + shadow_offset,
             x + pin_radius + shadow_offset, y + pin_radius + shadow_offset],
            fill=(0, 0, 0, 70)
        )

        # Clean red circle with thin white outline
        draw.ellipse(
            [x - pin_radius, y - pin_radius, x + pin_radius, y + pin_radius],
            fill=(210, 32, 32, 245),
            outline=(255, 255, 255, 245),
            width=1
        )

        # White number centered
        label = str(point["map_num"])
        bbox = draw.textbbox((0, 0), label, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text((x - tw // 2, y - th // 2 - 1), label, fill=(255, 255, 255, 255), font=font)

    # Composite overlay onto base map
    result = Image.alpha_composite(img, overlay)
    result = result.convert("RGB")
    result.save(img_path, "PNG", quality=95)
    print(f"  Circular pins drawn ({len(valid)} pins)")


# --- Custom road labels via OSM + Pillow ---

def draw_road_labels(
    img_path: str,
    center_lat: float, center_lon: float, zoom: int,
    img_width: int, img_height: int,
    max_roads: int = 25,
    font_size: int = 10,
) -> None:
    """Draw road name labels on the map — bold red text with white halo on every white road.

    Style matches Matt's Billings originals: bold red text sitting directly on the
    white road lines, following the road direction.
    """
    try:
        from osm_roads import fetch_and_parse_roads
    except ImportError:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "osm_roads",
            os.path.join(os.path.dirname(__file__), "osm_roads.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        fetch_and_parse_roads = mod.fetch_and_parse_roads

    # Compute the map's geographic bounding box from center/zoom/size
    scale = 2 ** zoom * 256 / 360
    lon_half = (img_width / 2) / scale
    lat_scale = math.cos(math.radians(center_lat))
    lat_half = (img_height / 2) / (scale * lat_scale)

    south = center_lat - lat_half
    north = center_lat + lat_half
    west = center_lon - lon_half
    east = center_lon + lon_half

    print(f"  Fetching road names from OSM (bbox: {south:.4f},{west:.4f},{north:.4f},{east:.4f})...")

    try:
        roads = fetch_and_parse_roads(south, west, north, east, max_roads=max_roads)
    except Exception as e:
        print(f"  WARNING: OSM road fetch failed: {e}")
        return

    if not roads:
        print("  No roads found from OSM")
        return

    print(f"  Got {len(roads)} road names from OSM")

    # Load the map image
    img = Image.open(img_path).convert("RGBA")

    # Load bold font for readability (matching Matt's style)
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    # Colors matching Matt's original: bold red text with white halo
    text_color = (180, 0, 0, 255)           # Bold red
    halo_color = (255, 255, 255, 240)        # Solid white halo

    # Track placed label rectangles for overlap detection
    placed_rects: list[tuple[int, int, int, int]] = []

    def rects_overlap(r1, r2, padding=8):
        """Check if two (x1, y1, x2, y2) rects overlap with padding."""
        return not (r1[2] + padding < r2[0] or r2[2] + padding < r1[0] or
                    r1[3] + padding < r2[1] or r2[3] + padding < r1[1])

    placed_count = 0
    for road in roads:
        name = prettify_road_label(road["name"])

        # Walk the road geometry densely to find candidate label positions
        # that are ON the road within the visible map area.
        geom = road.get("geometry", [])
        if len(geom) < 2:
            continue

        candidates = []
        # Sample every 3rd node for dense coverage
        step = max(1, min(3, len(geom) // 4))
        for idx in range(step, len(geom) - step, step):
            glat = geom[idx]["lat"]
            glon = geom[idx]["lon"]
            px, py = lat_lon_to_pixel_google(
                glat, glon, center_lat, center_lon, zoom,
                img_width, img_height,
            )

            # Compute smoothed bearing using 5 nodes before/after
            spread = 5
            i0 = max(0, idx - spread)
            i1 = min(len(geom) - 1, idx + spread)
            dlat = geom[i1]["lat"] - geom[i0]["lat"]
            dlon = (geom[i1]["lon"] - geom[i0]["lon"]) * lat_scale
            local_bearing = math.degrees(math.atan2(dlon, dlat)) % 360
            # Normalize so text reads left-to-right
            if 135 < local_bearing <= 315:
                local_bearing = (local_bearing + 180) % 360
            candidates.append((px, py, local_bearing))

        # Filter to candidates within the visible map (with margin)
        margin = 30
        visible = [(px, py, brg) for px, py, brg in candidates
                   if margin < px < img_width - margin and margin < py < img_height - margin]

        if not visible:
            continue

        # Pick the candidate that's furthest from any already-placed label
        # (spreads labels out across the map, avoids clustering)
        best = None
        best_min_dist = -1
        for px, py, brg in visible:
            if placed_rects:
                min_dist = min(
                    math.hypot(px - (r[0] + r[2]) / 2, py - (r[1] + r[3]) / 2)
                    for r in placed_rects
                )
            else:
                min_dist = float("inf")
            if min_dist > best_min_dist:
                best_min_dist = min_dist
                best = (px, py, brg)

        if best is None:
            continue

        px, py, local_bearing = best

        # Render the label: red text with white halo
        bbox = font.getbbox(name)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        pad = 3

        txt_img = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
        txt_draw = ImageDraw.Draw(txt_img)

        # White halo — draw text at offsets for a 1px white border
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                txt_draw.text((pad + dx - bbox[0], pad + dy - bbox[1]),
                              name, fill=halo_color, font=font)

        # Bold red text on top
        txt_draw.text((pad - bbox[0], pad - bbox[1]),
                      name, fill=text_color, font=font)

        # Rotate to follow road direction
        pillow_angle = 90 - local_bearing
        txt_rotated = txt_img.rotate(pillow_angle, expand=True, resample=Image.BICUBIC)

        # Center the label on the road point
        rw, rh = txt_rotated.size
        paste_x = px - rw // 2
        paste_y = py - rh // 2

        # Overlap check
        new_rect = (paste_x, paste_y, paste_x + rw, paste_y + rh)
        overlap = False
        for existing in placed_rects:
            if rects_overlap(new_rect, existing):
                overlap = True
                break
        if overlap:
            # Try 2 more candidates before giving up
            for alt_px, alt_py, alt_brg in visible:
                if (alt_px, alt_py, alt_brg) == best:
                    continue
                alt_bbox = font.getbbox(name)
                alt_tw = alt_bbox[2] - alt_bbox[0]
                alt_th = alt_bbox[3] - alt_bbox[1]
                alt_rotated = txt_img.rotate(90 - alt_brg, expand=True, resample=Image.BICUBIC)
                arw, arh = alt_rotated.size
                apx = alt_px - arw // 2
                apy = alt_py - arh // 2
                alt_rect = (apx, apy, apx + arw, apy + arh)
                alt_overlap = any(rects_overlap(alt_rect, ex) for ex in placed_rects)
                if not alt_overlap:
                    img.alpha_composite(alt_rotated, (apx, apy))
                    placed_rects.append(alt_rect)
                    placed_count += 1
                    overlap = False  # mark as placed
                    break
            if overlap:
                continue
        else:
            img.alpha_composite(txt_rotated, (paste_x, paste_y))
            placed_rects.append(new_rect)
            placed_count += 1

    result = img.convert("RGB")
    result.save(img_path, "PNG", quality=95)
    print(f"  Road labels drawn ({placed_count}/{len(roads)} placed, {len(roads) - placed_count} skipped for overlap)")


# --- Draw white road lines from OSM geometry ---

def draw_white_roads(
    img_path: str,
    center_lat: float, center_lon: float, zoom: int,
    img_width: int, img_height: int,
    targeted_only: bool = False,
) -> list[dict]:
    """Draw white road lines from OSM geometry on the satellite map.

    Matches the Google Maps style where roads appear as white lines on the
    satellite imagery.  Uses ``fetch_all_segments`` from osm_roads to get
    every road way (not just the longest per name) for full coverage.
    """
    try:
        from osm_roads import fetch_all_segments
    except ImportError:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "osm_roads",
            os.path.join(os.path.dirname(__file__), "osm_roads.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        fetch_all_segments = mod.fetch_all_segments

    # Compute the map's geographic bounding box from center/zoom/size
    scale = 2 ** zoom * 256 / 360
    lon_half = (img_width / 2) / scale
    lat_scale = math.cos(math.radians(center_lat))
    lat_half = (img_height / 2) / (scale * lat_scale)

    south = center_lat - lat_half
    north = center_lat + lat_half
    west = center_lon - lon_half
    east = center_lon + lon_half

    print(f"  Fetching road geometry from OSM for white roads...")

    try:
        segments = fetch_all_segments(south, west, north, east)
    except Exception as e:
        print(f"  WARNING: OSM road fetch failed: {e}")
        return []

    if not segments:
        print("  No road segments found from OSM")
        return []

    img = Image.open(img_path).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Draw a broader hierarchy so the map reads closer to the original survey:
    # strong interstates/highways plus visible secondary/tertiary arterials.
    _base = {
        "motorway": 12, "motorway_link": 7,
        "trunk": 10, "trunk_link": 6,
        "primary": 8, "primary_link": 5,
        "secondary": 4, "secondary_link": 3,
    }
    zoom_scale = 0.82 ** (13 - zoom)
    road_widths = {k: max(1, int(round(v * zoom_scale))) for k, v in _base.items()}

    target_terms = [
        "airport road", "east airport road", "old hardin road", "old hardin rd",
        "us highway 87 east", "us 87", "mt 3", "i 90 business", "i 90 bus"
    ]

    drawn = 0
    skipped = 0
    for seg in segments:
        geom = seg.get("geometry", [])
        if len(geom) < 2:
            continue

        hw = seg.get("highway", "residential")
        width = road_widths.get(hw)
        if width is None:
            skipped += 1
            continue  # Skip tertiary, residential, unclassified

        if targeted_only:
            hay = f"{seg.get('name', '')} {seg.get('ref', '')}".lower()
            if hw not in ("trunk", "trunk_link", "primary", "primary_link"):
                skipped += 1
                continue
            if not any(term in hay for term in target_terms):
                skipped += 1
                continue

        # Convert geometry points to pixel coordinates and split into sane chunks.
        chunks: list[list[tuple[int, int]]] = []
        current: list[tuple[int, int]] = []
        prev = None
        margin = 80
        max_jump = 120

        for pt in geom:
            px, py = lat_lon_to_pixel_google(
                pt["lat"], pt["lon"],
                center_lat, center_lon, zoom,
                img_width, img_height,
            )
            in_view = (-margin <= px <= img_width + margin and -margin <= py <= img_height + margin)
            if not in_view:
                if len(current) >= 2:
                    chunks.append(current)
                current = []
                prev = None
                continue

            if prev is not None:
                jump = math.hypot(px - prev[0], py - prev[1])
                if jump > max_jump:
                    if len(current) >= 2:
                        chunks.append(current)
                    current = []

            current.append((px, py))
            prev = (px, py)

        if len(current) >= 2:
            chunks.append(current)

        for pixels in chunks:
            # Stronger gray casing plus bright white center for a cleaner arterial look.
            draw.line(pixels, fill=(175, 175, 175, 210), width=width + 2)
            draw.line(pixels, fill=(255, 255, 255, 255), width=width)
            drawn += 1

    result = Image.alpha_composite(img, overlay)
    result = result.convert("RGB")
    result.save(img_path, "PNG", quality=95)
    print(f"  White roads drawn ({drawn} major, {skipped} minor skipped, {len(segments)} total)")
    return segments


# --- Highway shields (interstate, US, state) ---

def _extract_refs_from_segments(segments: list[dict]) -> list[dict]:
    """Extract highway ref data from pre-fetched road segments.

    Handles semicolon-separated multi-route refs (e.g. "90;US 212") by
    splitting into individual entries.  Deduplicates by individual ref and
    keeps the longest segment for center-point placement.
    """
    by_ref: dict[str, dict] = {}
    for seg in segments:
        raw_ref = seg.get("ref", "").strip()
        hw = seg.get("highway", "")
        if not raw_ref or hw not in ("motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link"):
            continue
        geom = seg.get("geometry", [])
        if len(geom) < 2:
            continue

        # Split semicolon-separated refs (e.g. "90;US 212" → ["90", "US 212"])
        individual_refs = [r.strip() for r in raw_ref.split(";") if r.strip()]

        for ref in individual_refs:
            # Keep the longest segment per ref for best placement
            if ref not in by_ref or len(geom) > by_ref[ref]["_geom_len"]:
                mid = len(geom) // 2
                by_ref[ref] = {
                    "ref": ref,
                    "highway": hw,
                    "center_lat": geom[mid]["lat"],
                    "center_lon": geom[mid]["lon"],
                    "_geom_len": len(geom),
                }

    results = list(by_ref.values())
    for r in results:
        r.pop("_geom_len", None)
    return results


def draw_highway_shields(
    img_path: str,
    center_lat: float, center_lon: float, zoom: int,
    img_width: int, img_height: int,
    segments: list[dict] | None = None,
) -> None:
    """Draw interstate and highway shields on the map.

    Extracts ``ref`` tags from pre-fetched *segments* (from ``draw_white_roads``)
    to avoid a separate Overpass API call that would trigger rate limiting.
    Falls back to ``fetch_highway_refs`` only when segments are not provided.
    """
    import re

    if segments:
        refs = _extract_refs_from_segments(segments)
        print(f"  Extracted {len(refs)} highway refs from cached road segments")
    else:
        # Fallback: separate API call (may 429 if other calls were recent)
        try:
            from osm_roads import fetch_highway_refs
        except ImportError:
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "osm_roads",
                os.path.join(os.path.dirname(__file__), "osm_roads.py"),
            )
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            fetch_highway_refs = mod.fetch_highway_refs

        # Compute bounding box
        scale = 2 ** zoom * 256 / 360
        lon_half = (img_width / 2) / scale
        lat_scale = math.cos(math.radians(center_lat))
        lat_half = (img_height / 2) / (scale * lat_scale)

        south = center_lat - lat_half
        north = center_lat + lat_half
        west = center_lon - lon_half
        east = center_lon + lon_half

        print(f"  Fetching highway refs from OSM for shields...")
        time.sleep(2)  # Avoid rate limiting after prior Overpass calls

        try:
            refs = fetch_highway_refs(south, west, north, east)
        except Exception as e:
            print(f"  WARNING: Highway ref fetch failed: {e}")
            return

    if not refs:
        print("  No highway refs found")
        return

    img = Image.open(img_path).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Two font sizes: large for interstate shields (pin-sized), small for state routes
    try:
        interstate_font = ImageFont.truetype("arialbd.ttf", 14)
        route_font = ImageFont.truetype("arialbd.ttf", 10)
    except (OSError, IOError):
        try:
            interstate_font = ImageFont.truetype("arial.ttf", 14)
            route_font = ImageFont.truetype("arial.ttf", 10)
        except (OSError, IOError):
            interstate_font = ImageFont.load_default()
            route_font = ImageFont.load_default()

    margin = 30
    placed_rects = []
    placed_count = 0

    for ref_info in refs:
        ref = ref_info["ref"]
        hw = ref_info["highway"]

        px, py = lat_lon_to_pixel_google(
            ref_info["center_lat"], ref_info["center_lon"],
            center_lat, center_lon, zoom,
            img_width, img_height,
        )

        if px < margin or px > img_width - margin or py < margin or py > img_height - margin:
            continue

        # Classify shield type
        has_i_prefix = bool(re.match(r"^I\s*\d+", ref))
        is_bare_number = bool(re.match(r"^\d+$", ref))
        is_motorway = hw in ("motorway", "motorway_link")
        is_interstate = has_i_prefix or (is_bare_number and is_motorway)
        is_us_route = ref.startswith("US ")

        if "business" in ref.lower():
            continue

        # Display text
        if is_interstate:
            display = re.sub(r"^I\s*", "", ref).strip()
            font = interstate_font
        else:
            display = ref
            font = route_font

        bbox = font.getbbox(display)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]

        if is_interstate:
            # --- Classic interstate shield polygon (pin-sized) ---
            pad_x, pad_y = 7, 4
            sw = tw + pad_x * 2
            sh = int(th * 2.6)  # taller for the shield shape
            sx = px - sw // 2
            sy = py - sh // 2

            # Shield outline: flat top, flared sides, pointed bottom
            top_y = sy
            mid_y = sy + int(sh * 0.35)  # widest point
            bot_y = sy + sh
            flare = 4  # pixels wider at the bulge

            shield_poly = [
                (sx + 2, top_y),                    # top-left (slightly inset)
                (sx + sw - 2, top_y),               # top-right
                (sx + sw + flare, mid_y),            # right bulge
                (sx + sw - 1, mid_y + int(sh * 0.2)),  # right taper
                (px, bot_y),                         # bottom point
                (sx + 1, mid_y + int(sh * 0.2)),    # left taper
                (sx - flare, mid_y),                 # left bulge
            ]

            # Blue body
            draw.polygon(shield_poly, fill=(0, 82, 164, 255))
            # White outline
            draw.polygon(shield_poly, outline=(255, 255, 255, 255))

            # Red stripe across top
            red_h = int(sh * 0.28)
            red_poly = [
                (sx + 2, top_y),
                (sx + sw - 2, top_y),
                (sx + sw + flare - 1, top_y + red_h),
                (sx - flare + 1, top_y + red_h),
            ]
            draw.polygon(red_poly, fill=(200, 30, 30, 255))

            # White number centered vertically in blue area
            text_x = px - tw // 2 - bbox[0]
            text_y = top_y + red_h + (sh - red_h - th) // 2 - bbox[1] - 1
            draw.text((text_x, text_y), display, fill=(255, 255, 255, 255), font=font)

            new_rect = (sx - flare - 4, sy - 4, sx + sw + flare + 4, bot_y + 4)

        elif is_us_route:
            # --- US route: white shield shape with black number ---
            pad_x, pad_y = 4, 3
            sw = tw + pad_x * 2
            sh = int(th * 2.2)
            sx = px - sw // 2
            sy = py - sh // 2
            top_y = sy
            bot_y = sy + sh

            us_poly = [
                (sx + 2, top_y),
                (sx + sw - 2, top_y),
                (sx + sw + 2, sy + int(sh * 0.35)),
                (sx + sw - 1, sy + int(sh * 0.6)),
                (px, bot_y),
                (sx + 1, sy + int(sh * 0.6)),
                (sx - 2, sy + int(sh * 0.35)),
            ]
            draw.polygon(us_poly, fill=(255, 255, 255, 255))
            draw.polygon(us_poly, outline=(0, 0, 0, 200))

            text_x = px - tw // 2 - bbox[0]
            text_y = top_y + (sh - th) // 2 - bbox[1]
            draw.text((text_x, text_y), display, fill=(0, 0, 0, 255), font=font)

            new_rect = (sx - 4, sy - 4, sx + sw + 4, bot_y + 4)

        else:
            # --- State route: white rounded rectangle with black text ---
            pad_x, pad_y = 4, 3
            sw = tw + pad_x * 2
            sh = th + pad_y * 2
            sx = px - sw // 2
            sy = py - sh // 2

            draw.rounded_rectangle(
                [sx, sy, sx + sw, sy + sh],
                radius=3,
                fill=(255, 255, 255, 240),
                outline=(0, 0, 0, 180),
                width=1,
            )
            text_x = sx + pad_x - bbox[0]
            text_y = sy + pad_y - bbox[1]
            draw.text((text_x, text_y), display, fill=(0, 0, 0, 255), font=font)

            new_rect = (sx - 4, sy - 4, sx + sw + 4, sy + sh + 4)

        # Overlap check
        overlap = any(
            not (new_rect[2] < r[0] or r[2] < new_rect[0] or
                 new_rect[3] < r[1] or r[3] < new_rect[1])
            for r in placed_rects
        )
        if overlap:
            continue

        placed_rects.append(new_rect)
        placed_count += 1

    result = Image.alpha_composite(img, overlay)
    result = result.convert("RGB")
    result.save(img_path, "PNG", quality=95)
    print(f"  Highway shields drawn ({placed_count}/{len(refs)} placed)")


def generate_map_image(
    listings: list[dict],
    output_path: str,
    width: int = 1200,
    height: int = 800,
    include_pins: bool = True,
    config: dict | None = None,
) -> dict:
    """Render a market survey map using the configured generalized pipeline."""
    config = config or load_render_config()
    render_mode = get_map_render_mode(config)
    api_key = get_api_key()
    mapbox_token = get_mapbox_token()
    geocoded = geocode_listings(listings, api_key, config=config)
    valid = [g for g in geocoded if g.get("lat") is not None and g.get("lon") is not None]

    result = {
        "success": False,
        "path": output_path,
        "geocoded": geocoded,
        "valid_count": len(valid),
        "used_satellite_base": False,
        "center_lat": None,
        "center_lon": None,
        "zoom": None,
        "crop_bottom": 0,
        "render_mode": render_mode,
        "qa_warnings": [],
    }

    if not valid:
        result["qa_warnings"].append("No valid geocoded listings were available for map rendering.")
        render_map_fallback(geocoded, output_path, width, height)
        result["success"] = os.path.exists(output_path)
        return result

    center_lat, center_lon, zoom, _bounds = resolve_map_camera(valid, width, height, config=config)
    result["center_lat"] = center_lat
    result["center_lon"] = center_lon
    result["zoom"] = zoom

    crop_bottom = int(config.get("output", {}).get("cropBottomPx", 50))
    full_height = height + crop_bottom
    result["crop_bottom"] = crop_bottom

    if render_mode in ("mapbox-style-native", "mapbox-osm-overlay") and mapbox_token:
        success = fetch_mapbox_satellite_map(center_lat, center_lon, zoom, output_path, mapbox_token, width, full_height, config=config)
        if success:
            if render_mode == "mapbox-osm-overlay":
                segments = draw_white_roads(output_path, center_lat, center_lon, zoom, width, full_height)
                draw_road_labels(output_path, center_lat, center_lon, zoom, width, full_height)
                draw_highway_shields(output_path, center_lat, center_lon, zoom, width, full_height, segments=segments)
            if include_pins:
                draw_circular_pins(output_path, geocoded, center_lat, center_lon, zoom, width, full_height, config=config)
            img = Image.open(output_path)
            img = img.crop((0, 0, width, height))
            img.save(output_path, "PNG", quality=95)
            result["used_satellite_base"] = True
            result["success"] = True
            return result

    if api_key:
        success = fetch_google_satellite_map(center_lat, center_lon, zoom, output_path, api_key, width, full_height)
        if success:
            draw_road_labels(output_path, center_lat, center_lon, zoom, width, full_height)
            draw_highway_shields(output_path, center_lat, center_lon, zoom, width, full_height)
            if include_pins:
                draw_circular_pins(output_path, geocoded, center_lat, center_lon, zoom, width, full_height, config=config)
            img = Image.open(output_path)
            img = img.crop((0, 0, width, height))
            img.save(output_path, "PNG", quality=95)
            result["used_satellite_base"] = True
            result["success"] = True
            result["render_mode"] = "google-osm-overlay"
            return result

        success = generate_google_static_map_from_addresses(listings, output_path, api_key, width=width, height=height)
        if success:
            result["success"] = True
            result["crop_bottom"] = 0
            result["render_mode"] = "google-address-fallback"
            return result

    render_map_fallback(geocoded, output_path, width, height)
    result["success"] = os.path.exists(output_path)
    result["crop_bottom"] = 0
    result["render_mode"] = "pillow-fallback"
    return result


# --- Combined: satellite + circular pins ---

def generate_satellite_map_with_pins(
    geocoded: list[dict],
    output_path: str,
    api_key: str,
    width: int = 1200,
    height: int = 800,
) -> bool:
    """Generate a satellite map with custom circular numbered pins.

    Tries Mapbox first (labels aligned by their engine), falls back to Google + OSM labels.
    """
    valid = [g for g in geocoded if g["lat"] is not None]
    if not valid:
        print("WARNING: No geocoded addresses for map.")
        return False

    bounds = get_bounds(valid)
    center_lat = (bounds["min_lat"] + bounds["max_lat"]) / 2
    center_lon = (bounds["min_lon"] + bounds["max_lon"]) / 2
    zoom = compute_zoom(bounds, width, height)

    # --- Try Mapbox first (pure satellite base + OSM white roads & labels) ---
    mapbox_token = get_mapbox_token()
    if mapbox_token:
        crop_bottom = 50
        full_height = height + crop_bottom
        success = fetch_mapbox_satellite_map(
            center_lat, center_lon, zoom,
            output_path, mapbox_token,
            width, full_height,
        )
        if success:
            # Draw white roads + red labels + shields from OSM (matching Google-style look)
            segments = draw_white_roads(output_path, center_lat, center_lon, zoom, width, full_height)
            draw_road_labels(output_path, center_lat, center_lon, zoom, width, full_height)
            draw_highway_shields(output_path, center_lat, center_lon, zoom, width, full_height, segments=segments)
            draw_circular_pins(output_path, geocoded, center_lat, center_lon, zoom, width, full_height)
            # Crop bottom to remove Mapbox attribution
            img = Image.open(output_path)
            img = img.crop((0, 0, width, height))
            img.save(output_path, "PNG", quality=95)
            print(f"  Cropped bottom {crop_bottom}px (Mapbox attribution removed)")
            print(f"  Final map saved (Mapbox): {output_path} ({os.path.getsize(output_path):,} bytes)")
            return True
        else:
            print("  Mapbox failed, falling back to Google...")

    # --- Fall back to Google + OSM labels ---
    # Request extra height so Google attribution falls in the crop zone
    crop_bottom = 50
    full_height = height + crop_bottom

    success = fetch_google_satellite_map(
        center_lat, center_lon, zoom,
        output_path, api_key,
        width, full_height,
    )

    if not success:
        return False

    # Draw custom road name labels + shields from OSM data (before pins, so pins sit on top)
    draw_road_labels(output_path, center_lat, center_lon, zoom, width, full_height)
    draw_highway_shields(output_path, center_lat, center_lon, zoom, width, full_height)

    # Overlay circular pins on the full-size image (positions are correct)
    draw_circular_pins(output_path, geocoded, center_lat, center_lon, zoom, width, full_height)

    # Crop bottom strip to remove Google attribution ("Google" + "Map data ©20XX")
    img = Image.open(output_path)
    img = img.crop((0, 0, width, height))
    img.save(output_path, "PNG", quality=95)
    print(f"  Cropped bottom {crop_bottom}px (attribution removed)")

    print(f"  Final map saved (Google): {output_path} ({os.path.getsize(output_path):,} bytes)")
    return True


# --- Address-based fallback (teardrop markers, for when geocoding fails entirely) ---

def generate_google_static_map_from_addresses(
    listings: list[dict],
    output_path: str,
    api_key: str,
    width: int = 1200,
    height: int = 800,
) -> bool:
    """Fallback: generate map with Google's built-in markers using addresses directly."""
    api_w = min(width // 2, 640)
    api_h = min(height // 2, 640)

    markers_params = []
    for i, listing in enumerate(listings):
        address = listing.get("address", "")
        if isinstance(address, dict):
            address = address.get("value", "")
        if not address:
            continue

        map_num = i + 1
        label = str(map_num) if map_num <= 9 else chr(64 + map_num)
        marker = f"color:red|size:small|label:{label}|{address}"
        markers_params.append(("markers", marker))

    if not markers_params:
        return False

    base_params = {
        "size": f"{api_w}x{api_h}",
        "scale": "2",
        "maptype": "hybrid",
        "key": api_key,
    }

    url = f"https://maps.googleapis.com/maps/api/staticmap?{urllib.parse.urlencode(base_params)}"
    for key, val in markers_params:
        url += f"&{key}={urllib.parse.quote(val)}"

    print(f"  Requesting satellite map with built-in markers ({len(markers_params)} markers)...")

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            img_data = resp.read()
            if len(img_data) < 1000:
                return False
            with open(output_path, "wb") as f:
                f.write(img_data)
            img = Image.open(output_path)
            if img.size != (width, height):
                img = img.resize((width, height), Image.LANCZOS)
                img.save(output_path, "PNG", quality=95)
            print(f"  Map saved: {output_path} ({os.path.getsize(output_path):,} bytes)")
            return True
    except Exception as e:
        print(f"ERROR: Google Static Maps failed: {e}")
        return False


# --- Pillow-only fallback ---

def lat_lon_to_pixel(lat: float, lon: float, bounds: dict, img_width: int, img_height: int, padding: int = 60) -> tuple[int, int]:
    """Convert lat/lon to pixel coordinates (simple projection for fallback)."""
    usable_w = img_width - 2 * padding
    usable_h = img_height - 2 * padding

    lat_range = bounds["max_lat"] - bounds["min_lat"]
    lon_range = bounds["max_lon"] - bounds["min_lon"]

    if lat_range == 0:
        lat_range = 0.01
    if lon_range == 0:
        lon_range = 0.01

    x = padding + int(((lon - bounds["min_lon"]) / lon_range) * usable_w)
    y = padding + int(((bounds["max_lat"] - lat) / lat_range) * usable_h)

    return x, y


def render_map_fallback(geocoded: list[dict], output_path: str, width: int = 1200, height: int = 800) -> None:
    """Render a simple map image with numbered pins (Pillow-only fallback)."""
    valid = [g for g in geocoded if g["lat"] is not None]
    if not valid:
        print("WARNING: No valid geocoded addresses. Skipping map generation.")
        return

    bounds = get_bounds(valid)
    img = Image.new("RGB", (width, height), color=(240, 240, 235))
    draw = ImageDraw.Draw(img)

    for i in range(5):
        y = int(height * i / 4)
        draw.line([(0, y), (width, y)], fill=(220, 220, 215), width=1)
        x = int(width * i / 4)
        draw.line([(x, 0), (x, height)], fill=(220, 220, 215), width=1)

    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except (OSError, IOError):
        font = ImageFont.load_default()

    pin_radius = 14
    for point in valid:
        x, y = lat_lon_to_pixel(point["lat"], point["lon"], bounds, width, height)
        draw.ellipse(
            [x - pin_radius + 2, y - pin_radius + 2, x + pin_radius + 2, y + pin_radius + 2],
            fill=(100, 100, 100, 128)
        )
        draw.ellipse(
            [x - pin_radius, y - pin_radius, x + pin_radius, y + pin_radius],
            fill=(200, 30, 30),
            outline=(140, 20, 20),
            width=2
        )
        label = str(point["map_num"])
        bbox = draw.textbbox((0, 0), label, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text((x - tw // 2, y - th // 2), label, fill="white", font=font)

    draw.text((10, 10), "Market Survey — Property Locations", fill=(50, 50, 50), font=font)
    img.save(output_path, "PNG", quality=95)
    print(f"Map saved (fallback): {output_path}")


# --- Main ---

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate map with numbered property pins")
    parser.add_argument("--data", required=True, help="Path to processed_listings.json")
    parser.add_argument("--output", default="./output/map.png", help="Output PNG path")
    parser.add_argument("--width", type=int, default=1200, help="Image width in pixels")
    parser.add_argument("--height", type=int, default=800, help="Image height in pixels")
    args = parser.parse_args()

    if not os.path.exists(args.data):
        print(f"ERROR: Data file not found: {args.data}")
        sys.exit(1)

    with open(args.data, "r", encoding="utf-8") as f:
        data = json.load(f)

    listings = data.get("listings", data) if isinstance(data, dict) else data
    print(f"Loaded {len(listings)} listings")

    config = load_render_config()
    api_key = get_api_key()
    mapbox_token = get_mapbox_token()
    if mapbox_token:
        print("Mapbox token found")
    elif api_key:
        print("Google Maps API key found")
    else:
        print("No provider key found — using cached geocoding and Pillow fallback where needed")

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    result = generate_map_image(
        listings,
        args.output,
        width=args.width,
        height=args.height,
        include_pins=True,
        config=config,
    )

    valid_count = result.get("valid_count", 0)
    print(f"Successfully geocoded {valid_count}/{len(result.get('geocoded', []))} addresses")
    for warning in result.get("qa_warnings", []):
        print(f"WARNING: {warning}")


if __name__ == "__main__":
    main()
