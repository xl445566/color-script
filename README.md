## Color-Script

#### [README 바로가기](https://github.com/xl445566/color-script/blob/main/projectREADME.md)

---

### 설명

#### 1. 코드 작성시 변수에 할당한 데이터의 타입에 따라 색상을 맵핑하여 시각적 도움을 줍니다.

#### 2. 바닐라 자바스크립트만 지원합니다.

#### 3. ESLint와 함께 사용을 권장합니다.

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

### 기능 설명

<br />

![code1](https://user-images.githubusercontent.com/78071591/158436862-c9fe8073-1856-473f-8956-d834c9a38665.gif)

- 마지막에는 반드시 ";" 을 붙여야 동작 합니다.

- 이미지와 같이 string , number , null , undefined , boolean , array , object 타입에 따라  
  setting.json 에서 설정된 색상으로 맵핑이 이루어 집니다.

- string , array 타입 뒤에 .length 를 입력시 number 타입으로 맵핑이 이루어 집니다.

- 배열의 [index] 로 요소의 타입을 알 수 있습니다.

- 객체의 점표기법으로 요소의 타입을 알 수 있습니다.

<br />

![code2](https://user-images.githubusercontent.com/78071591/158436877-180dce01-9788-43bd-9384-cee4b46c1c60.gif)

- var로 선언한 변수는 선언한 라인보다 먼저 사용될 경우 undefined로 맵핑 됩니다.  
  (let , const 는 맵핑 되지 않습니다.)

- 변수를 값으로 할당 받을 경우 같은 타입으로 맵핑 됩니다.

- let , var로 선언한 변수만 재할당시 타입이 새로 맵핑 됩니다.

- export, export default / import 를 인식해 타입을 맵핑 합니다.  
  (단 경로의 뒤에 .js가 붙어야 동작 합니다.)
