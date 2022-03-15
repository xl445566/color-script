## Color-Script

---

### 설명

#### 1. 코드 작성시 변수에 할당한 데이터의 타입에 따라 색상을 맵핑하여 시각적 도움을 줍니다.

#### 2. 바닐라 자바스크립트를 지원합니다.

<br />

---

### 사용방법

- 설치 후 사용자 설정의 setting.json 파일에 아래 setting.json 에 있는 코드를 복사, 붙여넣기 후 저장 해주세요.

- Boolean, String, Number, Null, Undefined, Array, Object 7가지 타입의 색상은 아래  
  foreground 값의 변경을 통해 원하는 대로 커스터마이징 할 수 있습니다.

- 초기 Bold 스타일이 마음에 들지 않으신다면 "fontStyle" : "bold" 행을 지워 스타일의 변경을 줄 수 도 있습니다.

- fontStyle에는 italic , underline 등의 속성을 줄 수 있습니다.

```
ex) "fontStyle": "italic bold underline" // 기울임 두껍게 밑줄 3가지 속성을 할당하는 예시 입니다.
```

- setting.json

```
"editor.semanticTokenColorCustomizations": {
    "enabled": true,
    "rules": {
      "type.declaration.boolean": {
        "foreground": "#e74c3c",
        "fontStyle": "bold"
      },
      "type.declaration.string": {
        "foreground": "#0be881",
        "fontStyle": "bold"
      },
      "type.declaration.number": {
        "foreground": "#f1c40f",
        "fontStyle": "bold"
      },
      "type.declaration.null": {
        "foreground": "#D6A2E8",
        "fontStyle": "bold"
      },
      "type.declaration.undefined": {
        "foreground": "#9b59b6",
        "fontStyle": "bold"
      },
      "type.declaration.array": {
        "foreground": "#e67e22",
        "fontStyle": "bold"
      },
      "type.declaration.object": {
        "foreground": "#3742fa",
        "fontStyle": "bold"
      }
    }
  },
```

<br />

---
