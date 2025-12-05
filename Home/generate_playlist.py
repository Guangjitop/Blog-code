#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
播放列表生成脚本
扫描 musics 目录并生成 playlist.json 配置文件
支持格式: mp3, flac, wav, ogg, aac, m4a, webm
"""

import os
import json
from datetime import datetime
from typing import List, Dict, Optional
from zoneinfo import ZoneInfo

# 支持的音频格式
SUPPORTED_FORMATS = {'mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'webm'}


def parse_filename(filename: str) -> Dict[str, str]:
    """
    解析文件名，提取艺术家和歌曲名
    支持格式: "艺术家 - 歌曲名.格式" 或 "歌曲名.格式"
    
    Args:
        filename: 音乐文件名
        
    Returns:
        包含 artist, title, format 的字典
    """
    # 获取文件扩展名
    name, ext = os.path.splitext(filename)
    file_format = ext[1:].lower() if ext else ''
    
    # 尝试解析 "艺术家 - 歌曲名" 格式
    if ' - ' in name:
        parts = name.split(' - ', 1)
        artist = parts[0].strip()
        title = parts[1].strip()
    else:
        artist = '未知艺术家'
        title = name.strip()
    
    return {
        'artist': artist,
        'title': title,
        'format': file_format
    }


def scan_music_directory(directory: str) -> List[Dict[str, str]]:
    """
    扫描音乐目录，返回所有支持格式的音乐文件信息
    
    Args:
        directory: 音乐目录路径
        
    Returns:
        音乐文件信息列表
    """
    tracks = []
    
    if not os.path.exists(directory):
        print(f"目录不存在: {directory}")
        return tracks
    
    for filename in os.listdir(directory):
        # 获取文件扩展名
        _, ext = os.path.splitext(filename)
        file_format = ext[1:].lower() if ext else ''
        
        # 检查是否为支持的格式
        if file_format not in SUPPORTED_FORMATS:
            continue
        
        # 解析文件名
        track_info = parse_filename(filename)
        
        # 构建完整的音轨信息
        track = {
            'filename': filename,
            'path': f'musics/{filename}',
            'artist': track_info['artist'],
            'title': track_info['title'],
            'format': track_info['format']
        }
        
        tracks.append(track)
    
    # 按文件名排序
    tracks.sort(key=lambda x: x['filename'])
    
    return tracks


def generate_playlist_json(tracks: List[Dict[str, str]], output_path: str) -> None:
    """
    生成 playlist.json 文件
    
    Args:
        tracks: 音乐文件信息列表
        output_path: 输出文件路径
    """
    playlist = {
        'version': '1.0',
        'generatedAt': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
        'tracks': tracks
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(playlist, f, ensure_ascii=False, indent=4)
    
    print(f"已生成播放列表: {output_path}")
    print(f"共 {len(tracks)} 首歌曲")


def main():
    """主函数"""
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 音乐目录路径
    music_dir = os.path.join(script_dir, 'musics')
    
    # 输出文件路径
    output_path = os.path.join(script_dir, 'playlist.json')
    
    print(f"扫描目录: {music_dir}")
    print(f"支持格式: {', '.join(sorted(SUPPORTED_FORMATS))}")
    print("-" * 40)
    
    # 扫描音乐目录
    tracks = scan_music_directory(music_dir)
    
    if tracks:
        # 显示找到的歌曲
        for i, track in enumerate(tracks, 1):
            print(f"{i}. {track['artist']} - {track['title']} ({track['format']})")
        print("-" * 40)
    else:
        print("未找到任何音乐文件")
    
    # 生成播放列表
    generate_playlist_json(tracks, output_path)


if __name__ == '__main__':
    main()
