"use client";

import { useEffect } from 'react';

interface ToastProps {
    message: {
        text: string;
        type: 'success' | 'error';
    } | null;
    onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                onClose();
            }, message.type === 'success' ? 3000 : 5000);

            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) return null;

    return (
        <div className={`fixed top-24 right-4 z-50 max-w-md animate-slide-in-right ${message.type === 'success'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            } border-2 rounded-lg shadow-lg p-4 flex items-start gap-3`}>
            {/* Icon */}
            <div className="flex-shrink-0">
                {message.type === 'success' ? (
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ) : (
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )}
            </div>
            {/* Message */}
            <div className="flex-1">
                <p className="font-semibold">{message.type === 'success' ? 'Success!' : 'Error'}</p>
                <p className="text-sm mt-1">{message.text}</p>
            </div>
            {/* Close button */}
            <button
                onClick={onClose}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
