"use client";

import ConversationList from '@/components/chat/ConversationList';

export default function MessagesPage() {
  return (
    <div className="h-full w-full bg-white">
      {/* Mobile View: Show Conversation List */}
      <div className="md:hidden h-full">
        <ConversationList />
      </div>

      {/* Desktop View: Show Placeholder */}
      <div className="hidden md:flex h-full flex-col items-center justify-center text-center p-8 bg-gray-50">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Your Messages</h2>
        <p className="text-gray-500 max-w-sm">
          Select a conversation from the list to start chatting or find new tasks to connect with people.
        </p>
      </div>
    </div>
  );
}

// End of MessagesPage component