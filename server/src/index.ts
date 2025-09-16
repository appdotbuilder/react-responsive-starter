import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import { 
  signupInputSchema, 
  loginInputSchema, 
  updateProfileInputSchema,
  changePasswordInputSchema
} from './schema';

// Import handlers
import { signup } from './handlers/signup';
import { login } from './handlers/login';
import { logout } from './handlers/logout';
import { getCurrentUser } from './handlers/get_current_user';
import { updateProfile } from './handlers/update_profile';
import { changePassword } from './handlers/change_password';
import { getDashboardData } from './handlers/get_dashboard_data';
import { getLandingPageContent } from './handlers/get_landing_page_content';

// Define context type
type Context = {
  token?: string;
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(async ({ next, ctx }) => {
  // Extract token from context
  const token = ctx.token;
  
  if (!token) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication token required',
    });
  }

  // Validate token (placeholder - real implementation would verify JWT)
  return next({
    ctx: {
      ...ctx,
      token,
    },
  });
});

const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Public routes
  getLandingPageContent: publicProcedure
    .query(() => getLandingPageContent()),

  // Authentication routes
  signup: publicProcedure
    .input(signupInputSchema)
    .mutation(({ input }) => signup(input)),

  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),

  logout: protectedProcedure
    .mutation(({ ctx }) => logout(ctx.token)),

  // Protected user routes
  getCurrentUser: protectedProcedure
    .query(({ ctx }) => getCurrentUser(ctx.token)),

  updateProfile: protectedProcedure
    .input(updateProfileInputSchema)
    .mutation(({ ctx, input }) => updateProfile(ctx.token, input)),

  changePassword: protectedProcedure
    .input(changePasswordInputSchema)
    .mutation(({ ctx, input }) => changePassword(ctx.token, input)),

  // Dashboard routes
  getDashboardData: protectedProcedure
    .query(({ ctx }) => getDashboardData(ctx.token)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext({ req }): Context {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : undefined;
      
      return { token };
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();