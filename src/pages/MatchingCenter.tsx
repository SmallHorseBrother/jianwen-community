import React, { useState, useEffect } from 'react';
import { Heart, Users, Filter, Star, MessageCircle, UserPlus, X, Settings, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  findMatches, 
  createConnection, 
  getUserConnections,
  saveMatchPreferences,
  getMatchPreferences,
  recordActivity,
  MatchedUser,
  MatchPreferences 
} from '../services/matchingService';
import { GROUP_IDENTITIES, PROFESSIONS, SPECIALTIES, FITNESS_INTERESTS, LEARNING_INTERESTS } from '../types';

const MatchingCenter: React.FC = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [connections, setConnections] = useState<any>({});
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [preferences, setPreferences] = useState<MatchPreferences>({
    groups: [],
    professions: [],
    specialties: [],
    fitnessInterests: [],
    learningInterests: [],
    ageRange: { min: 18, max: 100 },
    radius: 50
  });

  useEffect(() => {
    if (user) {
      loadInitialData();
      checkProfileCompleteness();
    }
  }, [user]);

  const checkProfileCompleteness = () => {
    if (!user) return;
    
    // 检查用户资料是否足够完整进行匹配
    const hasBasicInfo = user.groupIdentity || user.profession;
    const hasInterests = (user.specialties && user.specialties.length > 0) ||
                        (user.fitnessInterests && user.fitnessInterests.length > 0) ||
                        (user.learningInterests && user.learningInterests.length > 0);
    
    setProfileIncomplete(!hasBasicInfo || !hasInterests);
  };

  const loadInitialData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // 并行加载数据
      const [userPreferences, userConnections, initialMatches] = await Promise.all([
        getMatchPreferences(user.id),
        getUserConnections(user.id),
        findMatches(user.id, undefined, 10)
      ]);

      if (userPreferences) {
        setPreferences(userPreferences);
      }
      
      setConnections(userConnections);
      setMatches(initialMatches);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFindMatches = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const newMatches = await findMatches(user.id, preferences, 20);
      setMatches(newMatches);
      
      // 记录匹配活动
      await recordActivity(user.id, 'profile_view', undefined, {
        action: 'find_matches',
        matches_found: newMatches.length
      });
    } catch (error) {
      console.error('Failed to find matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (targetUserId: string, connectionType: 'follow' | 'friend') => {
    if (!user) return;
    
    try {
      await createConnection(user.id, targetUserId, connectionType);
      
      // 更新本地状态
      const updatedConnections = await getUserConnections(user.id);
      setConnections(updatedConnections);
      
      // 记录活动
      await recordActivity(user.id, 'connection_request', targetUserId, {
        connection_type: connectionType
      });
      
      // 从匹配列表中移除已连接的用户
      setMatches(prev => prev.filter(match => match.id !== targetUserId));
    } catch (error) {
      console.error('Failed to create connection:', error);
    }
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    
    try {
      await saveMatchPreferences(user.id, preferences);
      setShowPreferences(false);
      
      // 使用新偏好重新匹配
      await handleFindMatches();
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const isConnected = (userId: string) => {
    const allConnections = [
      ...(connections.sent || []),
      ...(connections.received || []),
      ...(connections.friends || []),
      ...(connections.following || [])
    ];
    return allConnections.some((conn: any) => 
      conn.to_user_id === userId || conn.from_user_id === userId
    );
  };

  const MatchCard: React.FC<{ match: MatchedUser }> = ({ match }) => {
    const connected = isConnected(match.id);
    
    return (
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <span>{match.nickname}</span>
                {match.groupIdentity && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {match.groupIdentity}
                  </span>
                )}
              </h3>
              {match.groupNickname && (
                <p className="text-sm text-gray-600">群昵称：{match.groupNickname}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-1 text-yellow-500 mb-1">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-sm font-semibold">{match.matchScore}</span>
            </div>
            <p className="text-xs text-gray-500">匹配度</p>
          </div>
        </div>

        {match.bio && (
          <p className="text-gray-600 text-sm mb-4">{match.bio}</p>
        )}

        {match.profession && (
          <p className="text-sm text-gray-600 mb-3">专业：{match.profession}</p>
        )}

        {/* 匹配原因 */}
        {match.matchReasons.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">匹配原因：</p>
            <div className="flex flex-wrap gap-1">
              {match.matchReasons.slice(0, 3).map((reason, index) => (
                <span key={index} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                  {reason}
                </span>
              ))}
              {match.matchReasons.length > 3 && (
                <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded">
                  +{match.matchReasons.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 共同兴趣 */}
        {(match.commonInterests.specialties.length > 0 || 
          match.commonInterests.fitnessInterests.length > 0 || 
          match.commonInterests.learningInterests.length > 0) && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">共同兴趣：</p>
            <div className="space-y-1">
              {match.commonInterests.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {match.commonInterests.specialties.slice(0, 2).map((specialty, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                      {specialty}
                    </span>
                  ))}
                </div>
              )}
              {match.commonInterests.fitnessInterests.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {match.commonInterests.fitnessInterests.slice(0, 2).map((interest, index) => (
                    <span key={index} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                      {interest}
                    </span>
                  ))}
                </div>
              )}
              {match.commonInterests.learningInterests.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {match.commonInterests.learningInterests.slice(0, 2).map((interest, index) => (
                    <span key={index} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">
                      {interest}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex space-x-2">
          {!connected ? (
            <>
              <button
                onClick={() => handleConnect(match.id, 'friend')}
                className="flex-1 flex items-center justify-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span>加好友</span>
              </button>
              <button
                onClick={() => handleConnect(match.id, 'follow')}
                className="flex-1 flex items-center justify-center space-x-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                <Heart className="w-4 h-4" />
                <span>关注</span>
              </button>
            </>
          ) : (
            <div className="flex-1 text-center py-2 text-green-600 text-sm">
              ✓ 已连接
            </div>
          )}
        </div>
      </div>
    );
  };

  const PreferencesModal: React.FC = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">匹配偏好设置</h2>
            <button
              onClick={() => setShowPreferences(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* 群身份偏好 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                偏好的群身份
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GROUP_IDENTITIES.map(group => (
                  <label key={group} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={preferences.groups?.includes(group) || false}
                      onChange={(e) => {
                        const groups = preferences.groups || [];
                        if (e.target.checked) {
                          setPreferences(prev => ({
                            ...prev,
                            groups: [...groups, group]
                          }));
                        } else {
                          setPreferences(prev => ({
                            ...prev,
                            groups: groups.filter(g => g !== group)
                          }));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{group}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 专业偏好 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                偏好的专业领域
              </label>
              <select
                multiple
                value={preferences.professions || []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setPreferences(prev => ({ ...prev, professions: selected }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                size={5}
              >
                {PROFESSIONS.map(profession => (
                  <option key={profession} value={profession}>{profession}</option>
                ))}
              </select>
            </div>

            {/* 年龄范围 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                年龄范围
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">最小年龄</label>
                  <input
                    type="number"
                    min="18"
                    max="100"
                    value={preferences.ageRange?.min || 18}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      ageRange: { ...prev.ageRange, min: parseInt(e.target.value) || 18, max: prev.ageRange?.max || 100 }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">最大年龄</label>
                  <input
                    type="number"
                    min="18"
                    max="100"
                    value={preferences.ageRange?.max || 100}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      ageRange: { min: prev.ageRange?.min || 18, max: parseInt(e.target.value) || 100 }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 保存按钮 */}
            <div className="flex space-x-4">
              <button
                onClick={handleSavePreferences}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存偏好
              </button>
              <button
                onClick={() => setShowPreferences(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="text-center py-16">
        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">需要登录</h2>
        <p className="text-gray-600">请先登录以使用匹配功能</p>
      </div>
    );
  }

  if (profileIncomplete) {
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto bg-yellow-50 border border-yellow-200 rounded-xl p-8">
          <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">完善个人资料</h2>
          <p className="text-gray-600 mb-6">
            要使用匹配功能，请先完善你的个人资料：
          </p>
          <ul className="text-left text-sm text-gray-600 mb-6 space-y-2">
            <li>• 设置群身份或专业领域</li>
            <li>• 添加至少一个兴趣爱好</li>
            <li>• 完善个人简介</li>
          </ul>
          <Link
            to="/profile"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            去完善资料
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">🦉 枭马葛匹配中心</h1>
        <p className="text-gray-600">
          基于你的兴趣和偏好，智能匹配志同道合的群友
          <br />
          <span className="text-sm text-gray-500">
            💡 匹配算法会根据群身份、专业领域、兴趣爱好等因素计算匹配度
          </span>
        </p>
      </div>

      {/* 控制面板 */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleFindMatches}
              disabled={loading}
              className="flex items-center space-x-2 bg-pink-600 text-white px-6 py-2 rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
              <span>{loading ? '匹配中...' : '开始匹配'}</span>
            </button>
            
            <button
              onClick={() => setShowPreferences(true)}
              className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>偏好设置</span>
            </button>
          </div>

          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>好友: {connections.friends?.length || 0}</span>
            <span>关注: {connections.following?.length || 0}</span>
            <span>粉丝: {connections.followers?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* 匹配结果 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-pink-600" />
        </div>
      ) : matches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无匹配结果</h3>
          <p className="text-gray-600 mb-4">试试调整匹配偏好或完善个人资料</p>
          <button
            onClick={handleFindMatches}
            className="bg-pink-600 text-white px-6 py-2 rounded-lg hover:bg-pink-700 transition-colors"
          >
            重新匹配
          </button>
        </div>
      )}

      {/* 偏好设置模态框 */}
      {showPreferences && <PreferencesModal />}
    </div>
  );
};

export default MatchingCenter;