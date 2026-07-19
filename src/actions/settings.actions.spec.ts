import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/lib/staff-auth", () => ({ getStaffContextOrNull: vi.fn() }));
vi.mock("@/services/restaurant-settings.service", () => ({
  updateTaxProfile: vi.fn(),
  updateRestaurantProfile: vi.fn(),
  updateUsername: vi.fn(),
  regenerateUsername: vi.fn(),
}));
vi.mock("@/services/restaurant-image.service", () => ({
  addGalleryImage: vi.fn(),
  removeCover: vi.fn(),
  removeGalleryImage: vi.fn(),
  removeLogo: vi.fn(),
  uploadCover: vi.fn(),
  uploadLogo: vi.fn(),
}));
vi.mock("@/services/restaurant-video.service", () => ({
  addVideoLink: vi.fn(),
  removeVideo: vi.fn(),
  uploadVideoFile: vi.fn(),
}));

import { getManagerContextOrNull } from "@/lib/manager-auth";
import { removeGalleryImage } from "@/services/restaurant-image.service";
import {
  regenerateUsername,
  updateRestaurantProfile,
  updateTaxProfile,
  updateUsername,
} from "@/services/restaurant-settings.service";
import { addVideoLink, removeVideo } from "@/services/restaurant-video.service";
import {
  addVideoLinkAction,
  regenerateUsernameAction,
  removeGalleryImageAction,
  removeVideoAction,
  updateRestaurantProfileAction,
  updateTaxProfileAction,
  updateUsernameAction,
} from "./settings.actions";

describe("updateTaxProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagerContextOrNull).mockResolvedValue({
      userId: "u1",
      restaurantId: "res_1",
    });
  });

  it("delegates with the manager's restaurant", async () => {
    const result = await updateTaxProfileAction({
      gstRegistrationType: "REGULAR",
      serviceGstRate: 5,
      pricesTaxInclusive: false,
    });

    expect(result.success).toBe(true);
    expect(updateTaxProfile).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({ gstRegistrationType: "REGULAR" }),
    );
  });

  it("rejects an invalid profile (regular without a rate)", async () => {
    const result = await updateTaxProfileAction({
      gstRegistrationType: "REGULAR",
    });

    expect(result.success).toBe(false);
    expect(updateTaxProfile).not.toHaveBeenCalled();
  });

  it("returns NO_RESTAURANT without a restaurant", async () => {
    vi.mocked(getManagerContextOrNull).mockResolvedValue(null);

    const result = await updateTaxProfileAction({
      gstRegistrationType: "UNREGISTERED",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_RESTAURANT");
  });
});

const validProfile = {
  name: "Spice Route",
  serviceDineIn: true,
  serviceTakeaway: true,
  serviceDelivery: false,
};

describe("restaurant profile actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagerContextOrNull).mockResolvedValue({
      userId: "u1",
      restaurantId: "res_1",
    });
  });

  it("updateRestaurantProfileAction delegates with the restaurant id", async () => {
    const result = await updateRestaurantProfileAction(validProfile);

    expect(result.success).toBe(true);
    expect(updateRestaurantProfile).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({ name: "Spice Route" }),
    );
  });

  it("rejects when no service option is enabled", async () => {
    const result = await updateRestaurantProfileAction({
      ...validProfile,
      serviceDineIn: false,
      serviceTakeaway: false,
      serviceDelivery: false,
    });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(updateRestaurantProfile).not.toHaveBeenCalled();
  });

  it("rejects a default pointing at a disabled service option", async () => {
    const result = await updateRestaurantProfileAction({
      ...validProfile,
      serviceTakeaway: false,
      defaultOrderType: "TAKEAWAY",
    });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(updateRestaurantProfile).not.toHaveBeenCalled();
  });

  it("rejects an invalid FSSAI licence", async () => {
    const result = await updateRestaurantProfileAction({
      ...validProfile,
      fssaiLicense: "123",
    });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toBeDefined();
  });

  it("removeGalleryImageAction delegates the image id", async () => {
    const result = await removeGalleryImageAction({ imageId: "gi1" });

    expect(result.success).toBe(true);
    expect(removeGalleryImage).toHaveBeenCalledWith("res_1", "gi1");
  });

  it("addVideoLinkAction delegates the url + caption", async () => {
    const result = await addVideoLinkAction({
      url: "https://youtu.be/abc",
      caption: "Our story",
    });

    expect(result.success).toBe(true);
    expect(addVideoLink).toHaveBeenCalledWith(
      "res_1",
      "https://youtu.be/abc",
      "Our story",
    );
  });

  it("addVideoLinkAction rejects a non-URL", async () => {
    const result = await addVideoLinkAction({ url: "not a link" });

    expect(result.success).toBe(false);
    expect(addVideoLink).not.toHaveBeenCalled();
  });

  it("removeVideoAction delegates the video id", async () => {
    const result = await removeVideoAction({ id: "v1" });

    expect(result.success).toBe(true);
    expect(removeVideo).toHaveBeenCalledWith("res_1", "v1");
  });
});

describe("username actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagerContextOrNull).mockResolvedValue({
      userId: "u1",
      restaurantId: "res_1",
    });
  });

  it("updateUsernameAction delegates a normalized username", async () => {
    const result = await updateUsernameAction({ username: "Tasty_1" });

    expect(result.success).toBe(true);
    expect(updateUsername).toHaveBeenCalledWith("res_1", "tasty_1");
  });

  it("updateUsernameAction rejects an invalid username", async () => {
    const result = await updateUsernameAction({ username: "no" });

    expect(result.success).toBe(false);
    expect(updateUsername).not.toHaveBeenCalled();
  });

  it("regenerateUsernameAction returns the new username", async () => {
    vi.mocked(regenerateUsername).mockResolvedValue("fresh9");

    const result = await regenerateUsernameAction();

    expect(result.success).toBe(true);
    expect(result.data).toBe("fresh9");
    expect(regenerateUsername).toHaveBeenCalledWith("res_1");
  });

  it("regenerateUsernameAction fails without a restaurant", async () => {
    vi.mocked(getManagerContextOrNull).mockResolvedValue(null);

    const result = await regenerateUsernameAction();

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_RESTAURANT");
  });
});
