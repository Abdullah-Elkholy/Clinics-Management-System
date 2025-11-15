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
  gradient?: string;
  colorTheme?: 'blue' | 'red' | 'green' | 'purple';
  stats: StatCard[];
}

export default function StatsSection({ title: _title, gradient, colorTheme, stats }: StatsSectionProps) {
  // If colorTheme is provided, use it; otherwise fall back to gradient detection
  const theme = colorTheme || (() => {
    if (gradient?.includes('from-blue')) return 'blue';
    if (gradient?.includes('from-red')) return 'red';
    if (gradient?.includes('from-green')) return 'green';
    if (gradient?.includes('from-purple')) return 'purple';
    return 'blue';
  })();

  // Create gradient color mapping based on theme
  const getCardGradient = (index: number): string => {
    const themeGradients: Record<string, string[]> = {
      blue: [
        'bg-gradient-to-br from-blue-500 to-blue-600',
        'bg-gradient-to-br from-green-500 to-green-600',
        'bg-gradient-to-br from-purple-500 to-purple-600'
      ],
      red: [
        'bg-gradient-to-br from-red-500 to-red-600',
        'bg-gradient-to-br from-orange-500 to-orange-600',
        'bg-gradient-to-br from-amber-500 to-amber-600'
      ],
      green: [
        'bg-gradient-to-br from-green-500 to-green-600',
        'bg-gradient-to-br from-emerald-500 to-emerald-600',
        'bg-gradient-to-br from-teal-500 to-teal-600'
      ],
      purple: [
        'bg-gradient-to-br from-purple-500 to-purple-600',
        'bg-gradient-to-br from-pink-500 to-pink-600',
        'bg-gradient-to-br from-indigo-500 to-indigo-600'
      ]
    };

    return themeGradients[theme]?.[index] || themeGradients[theme]?.[0] || 'bg-gradient-to-br from-blue-500 to-blue-600';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {stats.map((stat, index) => {
        const cardGradient = getCardGradient(index);
        
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
