export const guestRoutes = [
  "/{sign-in,register,forgot-password,verify-email,new-password}",
];

export const protectedRoutes = [
  "/dashboards/**",
  "/pages/!({unauthorized-401,not-found-404,coming-soon,maintenance})/**",
];
