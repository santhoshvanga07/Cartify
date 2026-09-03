export const categories = [
  { name: 'Laptops', description: 'Notebooks and ultrabooks' },
  { name: 'Smartphones', description: 'Android and iOS phones' },
  { name: 'Footwear', description: 'Shoes for sport and outdoors' },
  { name: 'Audio', description: 'Headphones, earbuds and speakers' },
  { name: 'Accessories', description: 'Everyday tech accessories' },
];

// [name, brand, price, mrp, categoryName, stock, rating, reviews, attributes]
export const products = [
  ['Dell Inspiron 15', 'Dell', 54990, 62990, 'Laptops', 12, 4.2, 86, { RAM: '16GB', Processor: 'Intel i5 13th Gen', Storage: '512GB SSD', Screen: '15.6 inch', Weight: '1.65kg' }],
  ['HP Pavilion 14', 'HP', 58499, 67990, 'Laptops', 5, 4.4, 132, { RAM: '16GB', Processor: 'AMD Ryzen 7', Storage: '512GB SSD', Screen: '14 inch', Weight: '1.41kg' }],
  ['Lenovo IdeaPad Slim 3', 'Lenovo', 43990, 51990, 'Laptops', 18, 4.0, 54, { RAM: '8GB', Processor: 'Intel i3 12th Gen', Storage: '256GB SSD', Screen: '15.6 inch', Weight: '1.62kg' }],
  ['MacBook Air M3', 'Apple', 99900, 114900, 'Laptops', 3, 4.8, 240, { RAM: '16GB', Processor: 'Apple M3', Storage: '512GB SSD', Screen: '13.6 inch', Weight: '1.24kg' }],
  ['Asus Vivobook 16', 'Asus', 49990, 59990, 'Laptops', 0, 4.1, 71, { RAM: '16GB', Processor: 'Intel i5 12th Gen', Storage: '512GB SSD', Screen: '16 inch', Weight: '1.80kg' }],
  ['Acer Aspire Lite', 'Acer', 36990, 45990, 'Laptops', 22, 3.9, 43, { RAM: '8GB', Processor: 'AMD Ryzen 5', Storage: '512GB SSD', Screen: '15.6 inch', Weight: '1.59kg' }],

  ['Samsung Galaxy S24', 'Samsung', 64999, 79999, 'Smartphones', 20, 4.5, 410, { RAM: '8GB', Display: '6.2 inch AMOLED', Camera: '50MP', Battery: '4000mAh' }],
  ['Nothing Phone 2a', 'Nothing', 23999, 27999, 'Smartphones', 34, 4.3, 198, { RAM: '8GB', Display: '6.7 inch AMOLED', Camera: '50MP', Battery: '5000mAh' }],
  ['iPhone 15', 'Apple', 71900, 79900, 'Smartphones', 9, 4.7, 512, { RAM: '6GB', Display: '6.1 inch OLED', Camera: '48MP', Battery: '3349mAh' }],
  ['Redmi Note 13 Pro', 'Xiaomi', 19999, 24999, 'Smartphones', 55, 4.2, 620, { RAM: '8GB', Display: '6.67 inch AMOLED', Camera: '200MP', Battery: '5100mAh' }],
  ['OnePlus 12R', 'OnePlus', 39999, 45999, 'Smartphones', 14, 4.4, 287, { RAM: '8GB', Display: '6.78 inch AMOLED', Camera: '50MP', Battery: '5500mAh' }],
  ['Motorola Edge 50', 'Motorola', 27999, 32999, 'Smartphones', 0, 4.0, 96, { RAM: '8GB', Display: '6.7 inch pOLED', Camera: '50MP', Battery: '5000mAh' }],

  ['Wildcraft Trek Shoes', 'Wildcraft', 2799, 3999, 'Footwear', 48, 4.1, 76, { Waterproof: 'Yes', Sole: 'Rubber', Use: 'Trekking', Weight: '380g' }],
  ['Quechua MH100 Hiking', 'Quechua', 3499, 4299, 'Footwear', 30, 4.6, 154, { Waterproof: 'Yes', Sole: 'Grip rubber', Use: 'Hiking', Weight: '410g' }],
  ['Nike Revolution 7', 'Nike', 3695, 4295, 'Footwear', 25, 4.3, 203, { Waterproof: 'No', Sole: 'Foam', Use: 'Running', Weight: '250g' }],
  ['Adidas Galaxy 6', 'Adidas', 3299, 4999, 'Footwear', 0, 4.2, 167, { Waterproof: 'No', Sole: 'EVA', Use: 'Running', Weight: '270g' }],
  ['Puma Softride Trek', 'Puma', 4199, 5499, 'Footwear', 16, 4.0, 58, { Waterproof: 'Yes', Sole: 'Rubber', Use: 'Trekking', Weight: '395g' }],

  ['Sony WH-1000XM5', 'Sony', 26990, 34990, 'Audio', 11, 4.8, 389, { Type: 'Over-ear', NoiseCancelling: 'Yes', Battery: '30 hours', Bluetooth: '5.2' }],
  ['boAt Rockerz 550', 'boAt', 1799, 3990, 'Audio', 62, 4.1, 741, { Type: 'Over-ear', NoiseCancelling: 'No', Battery: '20 hours', Bluetooth: '5.0' }],
  ['JBL Tune 770NC', 'JBL', 7999, 9999, 'Audio', 19, 4.4, 226, { Type: 'Over-ear', NoiseCancelling: 'Yes', Battery: '44 hours', Bluetooth: '5.3' }],
  ['Apple AirPods Pro 2', 'Apple', 24900, 26900, 'Audio', 7, 4.7, 452, { Type: 'In-ear', NoiseCancelling: 'Yes', Battery: '6 hours', Bluetooth: '5.3' }],

  ['Logitech MX Master 3S', 'Logitech', 8495, 10995, 'Accessories', 21, 4.7, 178, { Type: 'Mouse', Connectivity: 'Bluetooth', Battery: '70 days', DPI: '8000' }],
  ['Anker 65W GaN Charger', 'Anker', 3299, 4499, 'Accessories', 40, 4.5, 132, { Type: 'Charger', Output: '65W', Ports: '2', Tech: 'GaN' }],
  ['Amazon Basics Laptop Bag', 'Amazon Basics', 1299, 1999, 'Accessories', 0, 3.8, 64, { Type: 'Bag', Fits: 'Up to 15.6 inch', Material: 'Polyester', Waterproof: 'No' }],
];
