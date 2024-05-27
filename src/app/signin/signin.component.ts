import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SigninService } from '../signin.service';
import { SocketService } from '../socket.service';
import { FormGroup, FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.css']
})


export class SigninComponent implements OnInit {
  errorMessage : string; // string to store error messages
  loginForm!: FormGroup;
  latitude: number;
  longitude: number;

  constructor(
  	private router: Router, private signinservice: SigninService, private socketservice: SocketService
  ) {
  		this.errorMessage = "";
      this.latitude = 0;
      this.longitude = 0;
    }

  ngOnInit(): void {
  	 this.loginForm = new FormGroup({
      username: new FormControl ('', [Validators.required]),
      password: new FormControl('', Validators.required)
  	 });
  }

  get f(){

    return this.loginForm.controls;

  }

  submit() {
    // check errors in the form
    if (!this.loginForm.valid) {
      console.log(this.loginForm.controls['password'].errors);
      return;
    }

    // AAA -> Get Browser Coordinates https://www.itsolutionstuff.com/post/angular-google-maps-get-current-locationexample.html
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
          this.latitude = position.coords.latitude;
          this.longitude = position.coords.longitude;

          this.signinservice.login(this.loginForm.value.username, this.loginForm.value.password, this.latitude, this.longitude)
            .subscribe({
              next: result => {
                // if the Http POST call made is successfull the result is a Token object
                this.signinservice.setToken(result); // store the received jwt token in the sign in service for future use in authentication
                this.socketservice.connect();	// connect the websocket since we already have the token
                
                //send a new user event to the server
                this.socketservice.sendEvent('userLogIn:username',{username: this.loginForm.value.username});
                this.errorMessage = "";
                //login successful navigate to acution page
                console.log('navigating to auction');
                this.router.navigate(['/auction']);
              },
              error: error => {
                this.errorMessage = <any>error;
                console.log('errorMessage: ', this.errorMessage);
                this.loginForm.controls['username'].setErrors({invalid: true});
              }
            });
        },
        (err) => {
          this.signinservice.login(this.loginForm.value.username, this.loginForm.value.password, this.latitude, this.longitude)
            .subscribe({
              next: result => {
                // if the Http POST call made is successfull the result is a Token object
          
                this.signinservice.setToken(result); // store the received jwt token in the sign in service for future use in authentication
                this.socketservice.connect();	// connect the websocket since we already have the token

                //send a user login event to the server
                this.socketservice.sendEvent('userLogIn:username',{username: this.loginForm.value.username});
                
                this.errorMessage = "";

                // navigate to auction page
                console.log('navigating to auction');
                this.router.navigate(['/auction']);
              },
              error: error => {
                this.errorMessage = <any>error;
                console.log('errorMessage: ', this.errorMessage);
                this.loginForm.get('username')?.setErrors({invalid: true});
              }
            });
        }
      );
      console.log("signin Component COORDINATES: ", this.longitude, this.latitude);
    }
  }
}
