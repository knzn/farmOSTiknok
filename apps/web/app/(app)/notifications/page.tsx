'use client'

export default function NotificationsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 border-b border-rim">
        <h1 className="text-ink text-2xl font-bold">Notifications</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-10 text-center">
        <div className="w-20 h-20 rounded-full bg-card border border-rim flex items-center justify-center mb-5">
          <span className="text-4xl">🔔</span>
        </div>
        <p className="text-ink text-lg font-bold mb-2">No notifications yet</p>
        <p className="text-ink-2 text-sm leading-6 max-w-xs">
          When someone likes or comments on your posts, or starts following you, it will show up here.
        </p>
      </div>
    </div>
  )
}
