skinparam shadowing false
skinparam padding 3
skinparam classBorderThickness 1

skinparam packageStyle rectangle

hide empty methods
hide empty fields

React.Game "creates and listens to, based on name" o-- Room
React.Game "gets view from & listens to" o-- Game
React.Canvas "renders" -- PIXI
React.Game "uses" *-- React.Canvas

class "quickconnect.connection" as qcc
Room "creates 1" o-- Game
Room "connects to" *-- qcc
Room "creates" *-- ServerConnection
Room "creates" *-- ClientConnection
Room "creates" *-- Client
Room "creates" *-- Server

ServerConnection "uses" o-- qcc
ClientConnection "uses" o-- qcc
Client "sends" -- ServerConnection
Server "receives" -- ServerAction
ClientConnection "forwards" -- ClientAction
ServerConnection "forwards" -- ServerAction
Server "sends" -- ClientAction
Client "receives" -- ClientAction

Client "uses" o-- Game
Game "uses" *-- PIXI
Client "has" *-- ClientRoundState

Server "has many" *-- Player
Server "has" *-- ServerRoundState
