"use client";

import Navbar from '@/components/layout/Navbar';
import ConversationList from '@/components/chat/ConversationList';

export default function MessagesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="h-[100svh] flex flex-col bg-background overflow-hidden">
            <Navbar />
            <div className="flex-1 flex overflow-hidden pt-16">
                {/* Desktop Sidebar - Always visible on md+ screens */}
                <div className="hidden md:flex w-80 flex-col border-r border-gray-200 h-full bg-white z-10">
                    <ConversationList />
                </div>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col min-w-0 bg-white h-full relative">
                    {children}
                </main>
            </div>
        </div>
    );
}
