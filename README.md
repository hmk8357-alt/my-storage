# 교사 도구함과 오늘의 조각

GitHub Pages용 정적 허브 시작 화면과 Firebase Google 로그인 기반 개인 일기장입니다. 기존 Apps Script 교사용 도구는 `public/hub-config.js`에 실제 `/exec` 주소를 넣으면 연결됩니다. 아직 주소를 설정하지 않아 준비 중으로 표시됩니다.

- 허브: https://hmk8357-alt.github.io/my-storage/
- 일기장: https://hmk8357-alt.github.io/my-storage/diary/
- 2026-11-07 Pages 배포, 실제 Google 로그인·저장·수정·새로고침 재조회·로그아웃 확인 완료. 검증용 기록은 정리했습니다.

## 로컬 실행

Node.js 24 이상에서 별도 앱 의존성 설치 없이 실행합니다.

```sh
node --test tests/domain.test.js
node scripts/build.js
node scripts/preview.js
```

미리보기: `http://127.0.0.1:4173/webapp-hub/`. 빌드 결과는 `dist/`에 생성됩니다. `public/`에 포함한 정적 파일만 배포합니다.

## Firebase

프로젝트: `teacher-diary-hub-20261107`. 공개 웹 앱 설정은 `public/firebase-config.js`에 있습니다. Firebase 웹 API 키는 공개 클라이언트 식별 설정이며, 데이터 접근 권한은 `firestore.rules`로 제어합니다. 서비스 계정 키나 OAuth secret을 소스에 넣지 마세요.

데이터 경로는 `users/{uid}/entries/{entryId}`입니다. Google 로그인 계정 본인만 일기를 읽고 쓸 수 있도록 규칙을 구성했습니다. 실제 프로젝트의 Google 제공자·허용 도메인·데이터베이스 생성·규칙 배포 상태는 `docs/prepublish-review.md`를 확인하세요.

현재 기본 데이터베이스는 서울(`asia-northeast3`) Standard이며 무료 할당량 대상입니다. 결제 계정을 연결하지 않았습니다. 무료 할당량은 서비스의 무제한 사용을 의미하지 않습니다.

공유 컴퓨터에 일기 원문이 지속적으로 남지 않도록 Firestore 캐시는 메모리만 사용하고, 인증은 브라우저 세션 범위로 유지합니다. 일기 원문은 Firebase로 전송됩니다. 종단간 암호화는 제공하지 않습니다.

## 백업

전체 기록을 복원 가능한 JSON 파일 여러 개로 나누어 제공합니다. 표시되는 파일을 모두 내려받으세요. 복원은 파일당 최대 200편·5MB이며 기존 기록은 덮어쓰지 않습니다. 기존 로컬 SQLite나 개인 백업을 자동 전송하지 않습니다.

## Pages

GitHub 저장소의 Pages 설정에서 GitHub Actions를 배포 소스로 선택합니다. `main` 브랜치에 업로드하면 `.github/workflows/pages.yml`이 테스트·빌드 후 `dist/`를 배포합니다. 일기장 Google 로그인을 위해 실제 Pages 도메인을 Firebase의 허용 도메인으로 등록해야 합니다.

현재 저장소는 GitHub Actions 소스로 설정됐고 실제 Pages 도메인은 Firebase에 등록되어 있습니다.

## 공개 범위와 개인정보

인증 도구·토큰·로컬 연결 설정·SQLite·개인 백업·학생 자료는 업로드 대상에서 제외합니다. 기존 교사 허브와 일기장 원본 폴더는 수정하지 않았습니다. 학생 자료를 수집하는 기존 교사용 서비스의 운영 주체·보존기간·처리 근거 등은 별도로 확정해야 합니다.
