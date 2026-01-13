"use client";

import {Authenticated, AuthLoading, ConvexReactClient, Unauthenticated} from "convex/react";
import {ClerkProvider, useAuth} from "@clerk/nextjs";
import {ConvexProviderWithClerk} from "convex/react-clerk"

import UnauthenticatedView from "@/features/auth/components/unauthenticated-view";

import {ThemeProvider} from "./theme-provider";
import AuthLoadingView from "@/features/auth/components/auth-loading-view";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const Providers = ({ children }: { children: React.ReactNode }) => {
    return (
        <ClerkProvider>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <Authenticated>
                        {children}
                    </Authenticated>
                    <Unauthenticated>
                        <UnauthenticatedView />
                    </Unauthenticated>
                    <AuthLoading>
                        <AuthLoadingView />
                    </AuthLoading>
                </ThemeProvider>
            </ConvexProviderWithClerk>
        </ClerkProvider>
    );
};