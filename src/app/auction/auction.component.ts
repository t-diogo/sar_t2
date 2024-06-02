import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../socket.service';
import { AuctionService } from '../auction.service';
import { SigninService } from '../signin.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Item } from '../item';
import { Chat } from '../chat';
import { User } from '../user';
import { Marker } from '../marker';


@Component({
  selector: 'app-auction',
  templateUrl: './auction.component.html',
  styleUrls: ['./auction.component.css']
})
export class AuctionComponent implements OnInit {
  items: Item[]; //array of items to store the items.
  users: User[]; 
  displayedColumns: string[] //Array of Strings with the table column names
  message: string; // message string
  destination: string; //string with the destination of the current message to send. 
  ChatMessage: string; // message string: string; // message string
  showBid: boolean; //boolean to control if the show bid form is placed in the DOM
  showMessage: boolean; //boolean to control if the send message form is placed in the DOM
  selectedItem!: Item; //Selected Item
  bidForm!: FormGroup; //FormGroup for the biding
  userName!: string;
  errorMessage: string; //string to store error messages received in the interaction with the api
  mapOptions: google.maps.MapOptions;
  markers: Marker[]; //array to store the markers for the looged users posistions.
  centerLat: number;
  centerLong: number;
  showRemove: boolean;
  soldHistory: string[];
  chats: Chat[]; //array for storing chat messages
  counter: number;

  constructor(private formBuilder: FormBuilder, private router: Router, private socketservice: SocketService, private auctionservice: AuctionService,
    private signinservice: SigninService) {
    this.items = [];
    this.users = [];
    this.soldHistory = [];
    this.chats = [];
    this.counter = 0;
    this.message = "";
    this.destination = "";
    this.ChatMessage = "";
    this.showBid = false;
    this.showMessage = false;
    this.userName = this.signinservice.token.username;
    this.errorMessage = "";
    this.displayedColumns = ['description', 'currentbid', 'buynow', 'remainingtime', 'wininguser', 'owner'];
    this.centerLat = this.signinservice.latitude != null ? this.signinservice.latitude : 38.640026;
    this.centerLong = this.signinservice.longitude != null ? this.signinservice.longitude : -9.155379;
    this.markers = [];
    this.showRemove = false;
    this.mapOptions = {
      center: { lat: this.centerLat, lng: this.centerLong },
      zoom: 10
    };
  }

  ngOnInit(): void {
    this.message = "Hello " + this.userName + "! Welcome to the SAR auction site.";

    //create bid form
    this.bidForm = this.formBuilder.group({
      bid: ['', Validators.compose([Validators.required, Validators.pattern("^[0-9]*$")])]
    });

    // Get initial item data from the server api using http call in the auctionservice
    this.auctionservice.getItems()
      .subscribe({
        next: result => {
          let receiveddata = result as Item[]; // cast the received data as an array of items (must be sent like that from server)
          console.log("getItems Auction Component -> received the following items: ", receiveddata);
          this.items = receiveddata;
        },
        error: error => this.errorMessage = <any>error
      });

    // Get initial list of logged in users for googleMaps using http call in the auctionservice
    this.auctionservice.getUsers()
      .subscribe({
        next: result => {
          let receiveddata = result as User[]; // cast the received data as an array of items (must be sent like that from server)
          console.log("getUsers Auction Component -> received the following users: ", receiveddata);
          // do the rest of the needed processing here
          this.users = receiveddata;

          // add the items to the markers array
          if (this.items && this.items.length > 0) {
            this.items.forEach(item => {
              this.setMarker(item);
            });
          }

        },
        error: error => this.errorMessage = <any>error
      });

    //subscribe to the incoming websocket events

    // subscribe to the server side regularly (each second) update:items event
    const updateItemsSubscription = this.socketservice.getEvent("update:items")
      .subscribe(
        data => {
          let receiveddata = data as Item[];
          console.log("received data: " + receiveddata);
          this.items = receiveddata;
        }
      );

    // subscribe to the server side regularly (each second) sold:items event
    const updateSoldItemsSubscription = this.socketservice.getEvent("sold:items")
      .subscribe(
        data => {
          let receiveddata = data as Item[];
          console.log("received data: " + receiveddata);

          if (receiveddata && receiveddata.length > 0) {
            // create a string representation for each item in the received data
            let sold_message = "";
            for (let i = 0; i < receiveddata.length; i++) {

              // hide showRemove button if selected item was sold
              if (this.selectedItem && this.selectedItem == receiveddata[i]) {
                this.showRemove = false;
                this.showBid = false;
              }

              if (receiveddata[i].wininguser == "") {
                // time expired and no one bought the item
                sold_message = receiveddata[i].description + " from " + receiveddata[i].owner + " was not sold.";

              } else if (receiveddata[i].wininguser == this.userName) {
                // the user won the item
                sold_message = receiveddata[i].description + " from " + receiveddata[i].owner  + " was sold to you for " + receiveddata[i].currentbid + "€";

              } else {
                // the item was sold to another user
                sold_message = receiveddata[i].description + " from " + receiveddata[i].owner + " was sold to " + receiveddata[i].wininguser + " for " + receiveddata[i].currentbid + "€";
              }
              // add the string to the soldHistory array
              this.soldHistory.push(sold_message);
            }

            // remove the sold items from the items array
            this.items = this.items.filter(item => !receiveddata.includes(item));

            // remove the sold items from the markers array
            for (let i = 0; i < receiveddata.length; i++) {
              this.removeMarker(receiveddata[i]);
            }
          }
        }
      );

    // subscribe to new item event sent by the server for each new item added to the auction
    const newItemSubscription = this.socketservice.getEvent("new:item")
      .subscribe(
        data => {
          let newItem = data as Item;
          console.log("received data: " + newItem);
          // add the new item to the items array
          this.items.push(newItem);
          // add the new item to the markers array
          this.setMarker(newItem);
        }
      );

    // subscribe to the remove item event sent by the server for each item that ends.
    const removeItemSubscription = this.socketservice.getEvent("remove:item")
      .subscribe(
        data => {
          let removedItem = data as Item;
          console.log("received data: " + removedItem);
          // remove the item from the items array
          this.items = this.items.filter(item => item !== removedItem);
          // add the new item to the markers array
          this.removeMarker(removedItem);
        }
      );

    //subscribe to the  logged in event that must be sent from the server when a client logs in
    const UserLogInSubscription = this.socketservice.getEvent("login:user")
      .subscribe(
        data => {
          let loggedInUser = data as User;
          if (this.users) {
            this.users.push(loggedInUser);
          }
        }
      );
    
    //subscribe to the logged out event that must be sent from the server when a client logs out
    const UserLogOutSubscription = this.socketservice.getEvent("logout:user")
    .subscribe(
      data => {
        let receiveddata = data as User;
        if (this.users) {
          for (let i = 0; i < this.users.length; i++) {
            if (this.users[i].username == receiveddata.username) {
              // remove the user from the users array
              this.users.splice(i, 1);
            }
          }
        }
      }
    );

    //subscribe to a receive:message event to receive message events sent by the server
    const receiveMessageSubscription = this.socketservice.getEvent("receive:message")
      .subscribe(
        data => {
          console.log("received message: data: ", data);
          let receiveddata = data as Chat;
          const chat = new Chat(receiveddata.sender, receiveddata.message, receiveddata.receiver);
          this.chats.push(chat);
          this.showMessage = true;
        }
      );

    //subscribe to the item sold event sent by the server for each item that ends.

    //subscription to any other events must be performed here inside the ngOnInit function

  }

  setMarker(item: Item): void {
    const owner = this.users.find(user => user.username === item.owner);
    if (owner && owner.latitude && owner.longitude) {
      this.markers.push(new Marker(
        { lat: owner.latitude, lng: owner.longitude },
        item.description + " - " + item.owner
      ));
    }
  }

  removeMarker(item: Item): void {
    const owner = this.users.find(user => user.username === item.owner);
    if (owner && owner.latitude && owner.longitude) {
      const index = this.markers.findIndex(marker => marker.label === item.description + " - " + item.owner);
      if (index > -1) {
        this.markers.splice(index, 1);
      }
    }
  }

  logout() {
    //call the logout function in the signInService to clear the token in the browser
    this.signinservice.logout();  // Tem que estar em primeiro para ser apagado o token e nao permitir mais reconnects pelo socket
    //perform any needed logout logic here
    this.socketservice.disconnect();
    //navigate back to the log in page
    this.router.navigate(['/signin']);
  }

  //function called when an item is selected in the view
  onRowClicked(item: Item) {
    console.log("Selected item = ", item);
    this.selectedItem = item;
    
    if (!item.owner.localeCompare(this.userName)) {
      this.showBid = false;
      this.showRemove = true;
      this.showMessage = false;
    }
    else {
      this.showBid = true;
      this.showRemove = false;
      this.destination = this.selectedItem.owner;
      this.showMessage = true;
    }
  }

  //function called when a received message is selected. 
  onMessageSender(ClickedChat: Chat) {
    //destination is now the sender of the selected received message.
    this.destination = ClickedChat.sender;
  }

  //function called when the user presses the send message button
  sendMessage() {
    console.log("Message  = ", this.ChatMessage);
    //send a message event to the server with the message and the destination
    this.socketservice.sendEvent('send:message', { message: this.ChatMessage, destination: this.destination });
  }

  // function called when the submit bid button is pressed
  submit() {
    console.log("submitted bid = ", this.bidForm.value.bid);
    //send a submit event to the server with info about the bid and the selected item
    this.socketservice.sendEvent('submit:bid', { bid: this.bidForm.value.bid, item: this.selectedItem });
  }

  //function called when the cancel bid button is pressed.
  cancelBid() {
    this.showBid = false; //hides the bid form
    this.bidForm.reset(); //clears bid value
  }

  //function called when the buy now button is pressed.
  buyNow() {
    this.bidForm.setValue({              /// sets the field value to the buy now value of the selected item
      bid: this.selectedItem.buynow
    });
    this.message = this.userName + " please press the Submit Bid button to procced with the Buy now order.";
  }

  //function called when the remove item button is pressed.
  removeItem() {
    this.showRemove = false;

    // call remove Item from the auction service
    this.auctionservice.removeItem(this.selectedItem)
      .subscribe({
        next: result => {
          console.log("removeItem Auction Component -> received the following result: ", result);
        },
        error: error => this.errorMessage = <any>error
      });
  }
}
