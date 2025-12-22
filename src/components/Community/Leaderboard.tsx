/**
 * 打卡排行榜
 * 展示本月最活跃的用户
 */

import React, { useState, useEffect } from 'react';
import { getLeaderboard } from '../../services/checkInService';
import { Trophy, Medal, User } from 'lucide-react';

interface LeaderboardUser {
  count: number;
  user: {
    nickname: string;
    avatar_url: string | null;
    group_nickname: string | null;
  };
}

const Leaderboard: React.FC = () => {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await getLeaderboard();
      setLeaders(data);
    } catch (error) {
      console.error('加载排行榜失败', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="w-5 h-5 text-yellow-500 fill-current" />;
      case 1: return <Medal className="w-5 h-5 text-gray-400 fill-current" />;
      case 2: return <Medal className="w-5 h-5 text-orange-600 fill-current" />;
      default: return <span className="text-sm font-bold text-gray-400 w-5 text-center">{index + 1}</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden sticky top-24">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 text-white">
        <h3 className="font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          活跃榜 (Top 10)
        </h3>
        <p className="text-orange-100 text-xs mt-1">坚持打卡，见证更好的自己</p>
      </div>

      <div className="p-2">
        {loading ? (
          <div className="text-center py-6 text-gray-400 text-sm">加载中...</div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">虚位以待，快来打卡！</div>
        ) : (
          <div className="space-y-1">
            {leaders.map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-2 hover:bg-orange-50 rounded-lg transition-colors">
                <div className="flex-shrink-0 w-8 flex justify-center">
                  {getRankIcon(index)}
                </div>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 overflow-hidden">
                  {item.user.avatar_url ? (
                    <img src={item.user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{item.user.nickname}</p>
                  {item.user.group_nickname && (
                    <p className="text-xs text-gray-400 truncate">{item.user.group_nickname}</p>
                  )}
                </div>
                <div className="text-sm font-medium text-orange-600">
                  {item.count} <span className="text-xs text-gray-400 font-normal">次</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
