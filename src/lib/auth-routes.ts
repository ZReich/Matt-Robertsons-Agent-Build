import pm from "picomatch";

import { guestRoutes, protectedRoutes } from "@/configs/auth-routes";

export const isGuestRoute = pm(guestRoutes);

export const isProtectedRoute = pm(protectedRoutes);
