#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
deploy_safe.py - 원클릭 자동 검증 및 안전 배포 파이프라인
1) DB 최신 데이터 로컬 동기화 (sync_cache_from_db.py)
2) 4단계 자동 무결성 검증 (verify_pipeline.py)
3) 무결성 100% 검증 통과 시에만 Git Commit & Push 실행
"""

import sys
import os
import subprocess

def run_cmd(cmd, step_name):
    print(f"\n>> [{step_name}] 실행 중: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"\n[CRITICAL ERROR] '{step_name}' 단계에서 오류가 발생했습니다 (코드: {result.returncode}).")
        print("데이터 유실 및 안전을 위해 배포가 강제 중단되었습니다.")
        sys.exit(result.returncode)
    return result

def main():
    commit_msg = "Deploy updates with verified SSOT Supabase DB architecture and integrity pipeline"
    if len(sys.argv) > 1:
        commit_msg = " ".join(sys.argv[1:])

    print("=" * 65)
    print("   [친환경차 관리 시스템 - 원클릭 안전 배포 파이프라인]")
    print("=" * 65)

    # 1. 최신 DB 캐시 동기화
    run_cmd([sys.executable, "sync_cache_from_db.py"], "1단계: Supabase DB 최신 데이터 동기화")

    # 2. 자동 무결성 검증 파이프라인 실행
    run_cmd([sys.executable, "verify_pipeline.py"], "2단계: 배포 전 자동 무결성 전수 검증")

    # 3. Git 스테이징
    run_cmd(["git", "add", "."], "3단계: 변경 파일 Git 스테이징")

    # 4. Git 커밋
    run_cmd(["git", "commit", "-m", commit_msg], "4단계: 변경 내역 Git 커밋")

    # 5. Git 푸시 (클라우드 배포)
    run_cmd(["git", "push"], "5단계: GitHub 클라우드 안전 푸시")

    print("\n" + "=" * 65)
    print("   [배포 성공] 모든 검증을 통과하고 안전하게 배포되었습니다!")
    print("=" * 65)

if __name__ == "__main__":
    main()
