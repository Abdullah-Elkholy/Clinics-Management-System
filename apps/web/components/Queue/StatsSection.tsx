'use client';

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  editButton?: {
    isEditing: boolean;
    currentValue: string | number;
    onEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    onChange: (value: string) => void;
    suffix?: string;
  };
}

interface StatsSectionProps {
  title?: string;
  gradient: string;
  stats: StatCard[];
}

export default function StatsSection({ title, gradient, stats }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {stats.map((stat, index) => {
        // Parse the gradient color from the gradient class to create individual card colors
        let cardGradient = gradient;
        
        // Map gradients to color-specific cards
        if (gradient.includes('from-blue')) {
          // OngoingTasksPanel - use different shades of blue
          const blues = [
            'bg-gradient-to-br from-blue-500 to-blue-600',
            'bg-gradient-to-br from-green-500 to-green-600',
            'bg-gradient-to-br from-purple-500 to-purple-600'
          ];
          cardGradient = blues[index] || gradient;
        } else if (gradient.includes('from-red')) {
          // FailedTasksPanel - use red, orange, amber
          const reds = [
            'bg-gradient-to-br from-red-500 to-red-600',
            'bg-gradient-to-br from-orange-500 to-orange-600',
            'bg-gradient-to-br from-amber-500 to-amber-600'
          ];
          cardGradient = reds[index] || gradient;
        } else if (gradient.includes('from-green')) {
          // CompletedTasksPanel - use green, emerald, teal
          const greens = [
            'bg-gradient-to-br from-green-500 to-green-600',
            'bg-gradient-to-br from-emerald-500 to-emerald-600',
            'bg-gradient-to-br from-teal-500 to-teal-600'
          ];
          cardGradient = greens[index] || gradient;
        } else if (gradient.includes('from-purple')) {
          // QueueDashboard - use purple gradient for all
          cardGradient = gradient;
        }

        return (
          <div key={index} className={`${cardGradient} text-white p-6 rounded-lg`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {stat.editButton && stat.editButton.isEditing ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm opacity-90">{stat.label}</p>
                    <div className="flex gap-2 items-center flex-wrap">
                      <input
                        type="number"
                        value={stat.editButton.currentValue}
                        onChange={(e) => stat.editButton!.onChange(e.target.value)}
                        className="px-2 py-1 text-gray-800 rounded text-base font-bold"
                        style={{ width: 'fit-content', minWidth: '2.5em', maxWidth: '5em' }}
                        autoFocus
                      />
                      {stat.editButton.suffix && (
                        <span className="text-sm opacity-75">{stat.editButton.suffix}</span>
                      )}
                      <button
                        onClick={stat.editButton.onSave}
                        className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-bold transition-all"
                      >
                        ✓ حفظ
                      </button>
                      <button
                        onClick={stat.editButton.onCancel}
                        className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-bold transition-all"
                      >
                        ✕ إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm opacity-90">{stat.label}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-3xl font-bold">
                        {stat.value}
                        {stat.editButton?.suffix && !stat.editButton.isEditing && (
                          <span className="text-xs opacity-75"> {stat.editButton.suffix}</span>
                        )}
                      </p>
                      {stat.editButton && !stat.editButton.isEditing && (
                        <button
                          onClick={stat.editButton.onEdit}
                          className="bg-white bg-opacity-20 hover:bg-opacity-40 text-white px-3 py-2 rounded-lg transition-all duration-200 border border-white border-opacity-40 hover:border-opacity-100 shadow-lg hover:shadow-xl"
                          title={`تعديل ${stat.label}`}
                        >
                          <i className="fas fa-edit text-base font-bold"></i>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="text-4xl opacity-20">
                <i className={`fas fa-${stat.icon}`}></i>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
