"use client";

export function TaskCardSkeleton() {
    return (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-gray-200" />
                    <div className="flex flex-col gap-1">
                        <div className="h-4 w-24 bg-gray-200 rounded" />
                        <div className="h-3 w-16 bg-gray-200 rounded" />
                    </div>
                </div>
            </div>

            {/* Image placeholder */}
            <div className="w-full aspect-[16/10] bg-gray-200" />

            {/* Content */}
            <div className="px-6 py-5 sm:px-8 sm:py-6">
                <div className="mb-4">
                    <div className="h-6 w-3/4 bg-gray-200 rounded mb-2" />
                    <div className="h-4 w-full bg-gray-200 rounded mb-1" />
                    <div className="h-4 w-5/6 bg-gray-200 rounded" />
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-100 rounded-2xl p-2 h-16" />
                    <div className="bg-gray-100 rounded-2xl p-2 h-16" />
                </div>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                    <div className="h-10 flex-1 bg-gray-100 rounded-xl mx-1" />
                    <div className="h-10 flex-1 bg-gray-100 rounded-xl mx-1" />
                    <div className="h-10 flex-1 bg-gray-100 rounded-xl mx-1" />
                </div>
            </div>
        </div>
    );
}

export function WorkerCardSkeleton() {
    return (
        <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
            <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
                    <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
                    <div className="h-4 w-full bg-gray-200 rounded mb-1" />
                    <div className="h-4 w-4/5 bg-gray-200 rounded" />
                </div>
            </div>
            <div className="mt-4 flex gap-2">
                <div className="h-8 w-20 bg-gray-200 rounded-full" />
                <div className="h-8 w-20 bg-gray-200 rounded-full" />
            </div>
        </div>
    );
}

export function ProfileSkeleton() {
    return (
        <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
            <div className="flex flex-col items-center">
                <div className="h-24 w-24 rounded-full bg-gray-200 mb-4" />
                <div className="h-6 w-32 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
                <div className="h-4 w-full bg-gray-200 rounded mb-2" />
                <div className="h-4 w-5/6 bg-gray-200 rounded" />
            </div>
        </div>
    );
}

export function MessageSkeleton() {
    return (
        <div className="bg-white border-b border-gray-200 p-4 animate-pulse">
            <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
                    <div className="h-4 w-48 bg-gray-200 rounded" />
                </div>
                <div className="h-4 w-12 bg-gray-200 rounded" />
            </div>
        </div>
    );
}

export function NotificationSkeleton() {
    return (
        <div className="bg-white border-b border-gray-200 p-4 animate-pulse">
            <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="h-4 w-full bg-gray-200 rounded mb-2" />
                    <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                </div>
            </div>
        </div>
    );
}

export function SkeletonList({ count = 3, type = 'task' }: { count?: number; type?: 'task' | 'worker' | 'message' | 'notification' }) {
    const SkeletonComponent = {
        task: TaskCardSkeleton,
        worker: WorkerCardSkeleton,
        message: MessageSkeleton,
        notification: NotificationSkeleton,
    }[type];

    return (
        <div className="flex flex-col gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonComponent key={i} />
            ))}
        </div>
    );
}
