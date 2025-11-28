import React from 'react';
import { FriendRank } from '../types';

interface LeaderboardProps {
  data: FriendRank[];
  currentScore?: number;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ data, currentScore }) => {
  // Merge current user score into leaderboard if provided
  let displayData = [...data];
  
  if (currentScore !== undefined) {
    displayData.push({
      id: 999,
      name: "Me",
      avatar: "https://picsum.photos/50/50?grayscale",
      score: currentScore,
      isUser: true
    });
  }

  // Sort descending
  displayData.sort((a, b) => b.score - a.score);

  return (
    <div className="bg-gray-800 rounded-xl p-4 w-full max-w-sm border border-gray-700">
      <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-3 font-bold">Friend Ranking</h3>
      <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
        {displayData.map((friend, index) => (
          <div 
            key={friend.id} 
            className={`flex items-center justify-between p-2 rounded-lg ${friend.isUser ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-gray-700/30'}`}
          >
            <div className="flex items-center gap-3">
              <span className={`font-mono font-bold w-6 text-center ${index < 3 ? 'text-yellow-400' : 'text-gray-500'}`}>
                {index + 1}
              </span>
              <img 
                src={friend.avatar} 
                alt={friend.name} 
                className="w-8 h-8 rounded-full border border-gray-600"
              />
              <span className={`text-sm font-medium ${friend.isUser ? 'text-yellow-200' : 'text-gray-300'}`}>
                {friend.name}
              </span>
            </div>
            <span className="font-mono font-bold text-white">{friend.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
