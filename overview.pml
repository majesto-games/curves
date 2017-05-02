skinparam shadowing false
skinparam padding 3
skinparam classBorderThickness 1

skinparam packageStyle rectangle

hide empty methods
hide empty fields

React.Game "creates and listens to, based on name" o-- Room
React.Game "gets view from & listens to" o-- Game
Room "creates 1" o-- Game
class "quickconnect.connection" as qcc
Room "connects to" *-- qcc
Room "creates" *-- ServerConnection
Room "creates" *-- ClientConnection
ServerConnection "uses" o-- qcc
ClientConnection "uses" o-- qcc
ClientConnection "messages" o-- Client
ServerConnection "messages" -- Server
Client "messages" o-- ServerConnection
Client "uses" o-- Game
Game "uses" -- PIXI
React.Canvas "renders" -- PIXI
React.Game "uses" *-- React.Canvas
Client "has" *-- ClientRoundState
Server "has many" *-- Player
Server "has" *-- ServerRoundState
