import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { vi } from "vitest";

import { DeviceService } from "../services/device.service";
import { DesktopOnlyGuard } from "./desktop-only.guard";
import { MobileOnlyGuard } from "./mobile-only.guard";

describe("route guards", () => {
  function mount(guard: typeof DesktopOnlyGuard | typeof MobileOnlyGuard, mobile: boolean, url: string) {
    const navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        guard,
        { provide: DeviceService, useValue: { isMobile: () => mobile, isDesktop: () => !mobile } },
        { provide: Router, useValue: { url, navigate } },
      ],
    });
    return {
      guard: TestBed.inject(guard as any) as { canActivate(): boolean },
      navigate,
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it("porta il telefono su /play senza accumulare cronologia", () => {
    const { guard, navigate } = mount(DesktopOnlyGuard, true, "/tv");
    expect(guard.canActivate()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(["/play"], { replaceUrl: true });
  });

  it("non rimbalza se il telefono è già su /play", () => {
    const { guard, navigate } = mount(DesktopOnlyGuard, true, "/play");
    expect(guard.canActivate()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("lascia passare la TV da desktop", () => {
    const { guard, navigate } = mount(DesktopOnlyGuard, false, "/tv");
    expect(guard.canActivate()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("porta il desktop su /tv e non rimbalza se è già lì", () => {
    const first = mount(MobileOnlyGuard, false, "/play");
    expect(first.guard.canActivate()).toBe(false);
    expect(first.navigate).toHaveBeenCalledWith(["/tv"], { replaceUrl: true });

    TestBed.resetTestingModule();
    const second = mount(MobileOnlyGuard, false, "/tv");
    expect(second.guard.canActivate()).toBe(false);
    expect(second.navigate).not.toHaveBeenCalled();
  });

  it("lascia passare il telefono su /play", () => {
    const { guard, navigate } = mount(MobileOnlyGuard, true, "/play");
    expect(guard.canActivate()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
