from pathlib import Path
import cv2
import numpy as np
import pytest

from ml.predict import CLASS_NAMES, extract_oil_polygons, characterize_geometry


def test_unet_class_names_maps_sea_to_no_oil():
    """Verify class 2 is explicitly 'No oil' instead of 'Sea'."""
    assert CLASS_NAMES[2] == "No oil"
    assert CLASS_NAMES[0] == "Oil"
    assert CLASS_NAMES[1] == "Look-alike"


def test_clean_sea_scenes_exist_and_are_valid():
    """Verify the 2 clean-sea demo scenes and their ground truth masks."""
    base_dir = Path(__file__).resolve().parent.parent / "data" / "sar" / "demo_for_judges"
    offshore = base_dir / "demo_clean_sea_offshore.png"
    offshore_gt = base_dir / "demo_clean_sea_offshore_ground_truth_mask.png"
    corridor = base_dir / "demo_clean_sea_shipping_corridor.png"
    corridor_gt = base_dir / "demo_clean_sea_shipping_corridor_ground_truth_mask.png"

    assert offshore.exists(), f"Missing {offshore}"
    assert corridor.exists(), f"Missing {corridor}"

    img_off = cv2.imread(str(offshore), cv2.IMREAD_GRAYSCALE)
    assert img_off is not None and img_off.shape[0] > 0

    img_corr = cv2.imread(str(corridor), cv2.IMREAD_GRAYSCALE)
    assert img_corr is not None and img_corr.shape[0] > 0

    if offshore_gt.exists():
        gt_off = cv2.imread(str(offshore_gt), cv2.IMREAD_GRAYSCALE)
        assert np.all(gt_off != 1) and np.all(gt_off != 255), "Clean sea ground truth should have no oil pixels"

    if corridor_gt.exists():
        gt_corr = cv2.imread(str(corridor_gt), cv2.IMREAD_GRAYSCALE)
        assert np.all(gt_corr != 1) and np.all(gt_corr != 255), "Corridor clean sea should have no oil pixels"


def test_characterize_geometry_on_clean_sea_empty_mask():
    """Empty mask (all sea / No oil) yields no polygons and zero oil area."""
    empty_mask = np.full((256, 256), 2, dtype=np.uint8)  # all class 2 (No oil)
    poly = extract_oil_polygons(empty_mask, class_id=0)
    assert poly is None
    features = characterize_geometry(poly, pixel_size_m=50.0)
    assert features["area_sq_km"] == 0.0
    assert features["perimeter_km"] == 0.0
    assert features["age_estimate"] == "unknown"
