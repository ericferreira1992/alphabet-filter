# AlphabetFilter | Angular 9+

Angular component for filtering contents in alphabetical listing, using default or custom templates. Ideal to build contact lists.

Compatible with previous versions of Angular, except AngularJS.

# Demo

See a [live demo](https://ericferreira1992.github.io/alphabet-filter).

## Simple use

```html
<alphabet-filter 
    propAlphaOrder="name"
    propsSearch="name"
    placeholder="digite o nome do contato"
    height="100%"
    [data]="contacts"
    [noSmoothScroll]="true"
    (onClick)="selected($event)">
</alphabet-filter>
```
![](simple.png)

## Custom use (with ng-template)

```html
<alphabet-filter 
    propAlphaOrder="name"
    propsSearch="name"
    placeholder="digite o nome do contato"
    listClass="search-list"
    height="500px"
    [data]="contacts"
    (onClick)="selected($event)"
    [withTemplate]="true"
>
    <ng-template let-item>
      <div class="search-list-item">
        <img [src]="item.image">
        <span>{{item.name}}</span>
      </div>
    </ng-template>
</alphabet-filter>
```

![](with-template.png)

# Usage

## Install
`npm install alphabet-filter`

## Import into Module
```typescript
import { AlphabetFilterModule } from 'alphabet-filter';

@NgModule({
  imports: [
    ...,
    AlphabetFilterModule
  ],
  declarations: [...],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

## Insert into styles of `angular.json`
```json
...
"styles": [
  "...",
  "node_modules/alphabet-filter/alphabet-filter.scss"
],
...
```

# API

## Inputs/Outputs (Required)
Name		                | Type                | Description
----                    | ----                | ----
`data`		              | `any[]`             | Data to be listed.(ex .: ``` <... [data]="contacts"></...>```).
`propAlphaOrder`		    | `string`            | Property for name of the property to be ordered alphabetically.(ex .: ``` <... propAlphaOrder="name"></...>```).
`propsSearch`		        | `string` or `string[]` | Property(ies) to be filtered.(ex .: ``` <... [propsSearch]="['name']"></...>```).
`onClick`   		        | `EventEmitter<any>` | Emit on item click.(ex .: ``` <... (onClick)="selected($event)"></...>```).

## Inputs/Outputs (Optional)
Name		        | Type      | Description
----            | ----      | ----
`placeholder`   | `string`  | Placeholder of input filter. (ex .: ``` <... []=""></...>```).
`listClass`     | `string`  | Class name for list element. (ex .: ``` <... listClass="search-list"></...>```).
`height`        | `string`  | Height to be used throughout the component. (ex .: ``` <... height="100%"></...>```).
`withTemplate`  | `boolean` | Used when to need of customize using ng-template. (ex .: ``` <... [withTemplate]="true"></...>```).
`onCancel`   		| `EventEmitter<any>` | Used to enable "close" button.(ex .: ``` <... (onCancel)="cancel()"></...>```).
