import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-personal-finance-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './personal-finance-layout.html',
  styleUrl: './personal-finance-layout.scss'
})
export class PersonalFinanceLayout {}
