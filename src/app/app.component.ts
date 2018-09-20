import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'app';

  public window: Window = window;

  public contacts: any[] = [
    { name: 'Eric Ferreira', image: '' },
    { name: 'Adriano Vieira', image: '' },
    { name: 'Thu Newcombe', image: '' },
    { name: 'Stasia Isreal', image: '' },
    { name: 'Robbie Wininger', image: '' },
    { name: 'Daphine Truex', image: '' },
    { name: 'Su Juhl', image: '' },
    { name: 'Eda Banks', image: '' },
    { name: 'Bernita Izzo', image: '' },
    { name: 'Mayme Trader', image: '' },
    { name: 'Livia Luse', image: '' },
    { name: 'Celine File', image: '' },
    { name: 'Nyla Stockton', image: '' },
    { name: 'Kathleen Burwell', image: '' },
    { name: 'Bruce Slack', image: '' },
    { name: 'Jacquline July', image: '' },
    { name: 'Chelsey Feller', image: '' },
    { name: 'Particia Ours', image: '' },
    { name: 'Jazmin Island', image: '' },
    { name: 'Gracia Harvill', image: '' },
    { name: 'Jewel Elling', image: '' },
    { name: 'Maybelle Lagunas', image: '' },
    { name: 'Leonie Ewert', image: '' },
    { name: 'Keith Rabon', image: '' },
    { name: 'Mozelle Grimmer', image: '' },
    { name: 'Fabiola Flowers', image: '' },
    { name: 'Julian Simonds', image: '' },
    { name: 'Patrick Pascual', image: '' },
    { name: 'Efrain Gordillo', image: '' },
    { name: 'Kenneth Lewey', image: '' },
    { name: 'Abram Lawhorn', image: '' },
    { name: 'Paige Dunford', image: '' },
    { name: 'Thaddeus Gonzalez', image: '' },
    { name: 'Marylynn Cardiel', image: '' },
    { name: 'Jenny Schertz', image: '' },
    { name: 'Cher Engberg', image: '' },
    { name: 'Muriel Hawkinson', image: '' },
    { name: 'Blondell Hepfer', image: '' },
    { name: 'Perry Blackburn', image: '' },
    { name: 'Mitchel Cudjoe', image: '' },
    { name: 'Lucretia Kujawa', image: '' },
    { name: 'Suzette Dubose', image: '' },
    { name: 'Jacque Gravitt', image: '' },
    { name: 'Sunshine Wuensche', image: '' },
    { name: 'Huong Facey', image: '' },
    { name: 'Golden Como', image: '' },
    { name: 'Hassan Bohland', image: '' },
    { name: 'Nichelle Sidler', image: '' },
    { name: 'Yan Kulinski', image: '' },
    { name: 'Long Maroney', image: '' },
    { name: 'Merrill Sabo', image: '' },
    { name: 'Corrine Iwamoto', image: '' },
  ];

  selected(contact) {
  }
}
